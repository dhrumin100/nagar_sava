import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Thermometer, Eye, EyeOff, RefreshCw, Filter, ChevronRight, ChevronLeft } from "lucide-react";
import { reportStorage, CivicReport } from "@/lib/reportStorage";

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Category definitions
const CATEGORIES = [
  { id: 'Potholes', label: 'Potholes', keywords: ['potholes', 'pothole', 'Potholes'] },
  { id: 'Garbage', label: 'Garbage', keywords: ['garbage', 'Garbage'] },
  { id: 'Waterlogging', label: 'Waterlogging', keywords: ['waterlogging', 'Waterlogging', 'water'] },
  { id: 'Street Light', label: 'Street Lights', keywords: ['street light', 'Street Light', 'streetlight'] },
];

// Map report status to display categories
const getStatusDisplay = (status: string): { label: string; color: string } => {
  switch (status) {
    case 'resolved':
      return { label: 'Resolved', color: '#059669' };
    case 'in-progress':
    case 'pending-review':
      return { label: 'In Progress', color: '#D97706' };
    case 'reported':
    case 'assigned':
    default:
      return { label: 'New', color: '#DC2626' };
  }
};

// Map issue types to readable names
const formatIssueType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'Potholes': 'Pothole',
    'potholes': 'Pothole',
    'pothole': 'Pothole',
    'Garbage': 'Garbage',
    'garbage': 'Garbage',
    'Street Light': 'Street Light',
    'streetlight': 'Street Light',
    'Waterlogging': 'Waterlogging',
    'waterlogging': 'Waterlogging',
    'water': 'Water Issue',
  };
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
};

// Match issue type to category
const matchCategory = (issueType: string, categoryId: string): boolean => {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) return false;
  return category.keywords.some(kw => issueType.toLowerCase().includes(kw.toLowerCase()));
};

const CitizenMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatmapRef = useRef<L.LayerGroup | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ new: number; inProgress: number; resolved: number }>({ new: 0, inProgress: 0, resolved: 0 });
  
  // Filter state
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);

  // Toggle category filter
  const toggleFilter = (categoryId: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(categoryId)) {
        newFilters.delete(categoryId);
      } else {
        newFilters.add(categoryId);
      }
      return newFilters;
    });
  };

  // Get filtered reports
  const filteredReports = activeFilters.size === 0 
    ? reports 
    : reports.filter(r => {
        return Array.from(activeFilters).some(categoryId => matchCategory(r.issueType, categoryId));
      });

  // Fetch all reports (city-wide, not user-specific)
  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const allReports = await reportStorage.getAllReports();
      
      // Filter only reports with valid location data
      const validReports = allReports.filter(r => 
        r.location && 
        r.location.latitude && 
        r.location.longitude &&
        !isNaN(r.location.latitude) &&
        !isNaN(r.location.longitude)
      );
      
      setReports(validReports);
      
      // Calculate stats
      const newCount = validReports.filter(r => r.status === 'reported' || r.status === 'assigned').length;
      const inProgressCount = validReports.filter(r => r.status === 'in-progress' || r.status === 'pending-review').length;
      const resolvedCount = validReports.filter(r => r.status === 'resolved').length;
      setStats({ new: newCount, inProgress: inProgressCount, resolved: resolvedCount });
      
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map centered on Vadodara (default)
    map.current = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([22.3072, 73.1812], 12);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.current);

    // Initialize marker cluster group
    markersRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
    });
    map.current.addLayer(markersRef.current);
    
    // Initialize heatmap layer
    heatmapRef.current = L.layerGroup();

    // Fetch initial data
    fetchReports();

    // Handle window resize
    const handleResize = () => {
      if (map.current) {
        map.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    // Subscribe to report changes for live updates
    const unsubscribe = reportStorage.subscribe(() => {
      fetchReports();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribe();
      map.current?.remove();
    };
  }, [fetchReports]);

  // Update markers when filtered reports change
  useEffect(() => {
    if (!map.current || !markersRef.current || !heatmapRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();
    heatmapRef.current.clearLayers();

    if (filteredReports.length === 0) return;

    const bounds = L.latLngBounds([]);

    // Add markers for each filtered report
    filteredReports.forEach(report => {
      const { label, color } = getStatusDisplay(report.status);
      const severity = report.severity || 'medium';
      
      const icon = L.divIcon({
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: transform 0.15s ease;" class="map-marker-icon"></div>`,
        className: 'custom-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const lat = report.location.latitude;
      const lng = report.location.longitude;
      
      bounds.extend([lat, lng]);

      const marker = L.marker([lat, lng], { icon })
        // Hover tooltip - lightweight, subtle info preview
        .bindTooltip(`
          <div style="font-size: 12px; min-width: 120px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${formatIssueType(report.issueType)}</div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; background: ${color}20; color: ${color};">${label}</span>
              <span style="font-size: 10px; color: #666;">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
            </div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.95,
          className: 'map-tooltip'
        })
        // Click popup - detailed view
        .bindPopup(`
          <div class="p-2 min-w-[180px]">
            <h4 class="font-semibold text-sm">${formatIssueType(report.issueType)} Issue</h4>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="px-2 py-1 text-xs rounded" style="background-color: ${color}20; color: ${color};">
                ${label}
              </span>
              <span class="text-xs text-gray-500">Severity: ${severity}</span>
            </div>
          </div>
        `)
        .on('click', () => setSelectedReport({
          type: report.issueType,
          status: report.status,
          severity: severity,
          lat,
          lng
        }));

      markersRef.current?.addLayer(marker);

      // Add heatmap circle
      const intensity = severity === 'high' ? 0.8 : severity === 'medium' ? 0.5 : 0.3;
      const radius = severity === 'high' ? 500 : severity === 'medium' ? 300 : 200;
      
      const circle = L.circle([lat, lng], {
        color: '#DC2626',
        fillColor: '#DC2626',
        fillOpacity: intensity * 0.3,
        radius: radius,
        weight: 2
      });

      heatmapRef.current?.addLayer(circle);
    });

    // Auto-fit bounds to show all filtered reports
    if (bounds.isValid()) {
      map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

  }, [filteredReports]);

  const toggleHeatmap = () => {
    if (!map.current || !heatmapRef.current) return;
    
    if (showHeatmap) {
      map.current.removeLayer(heatmapRef.current);
    } else {
      map.current.addLayer(heatmapRef.current);
    }
    setShowHeatmap(!showHeatmap);
  };

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
          <Badge variant="secondary" className="mb-4 text-sm font-medium">
            <MapPin className="w-4 h-4 mr-2" />
            Live Map
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            City Issues Map
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Real-time visualization of civic issues across the city
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-card border border-border/50 p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.new}</div>
            <div className="text-sm text-muted-foreground">New Reports</div>
          </Card>
          <Card className="bg-gradient-card border border-border/50 p-4 text-center">
            <div className="text-2xl font-bold text-civic-orange">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </Card>
          <Card className="bg-gradient-card border border-border/50 p-4 text-center">
            <div className="text-2xl font-bold text-civic-green">{stats.resolved}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </Card>
        </div>

        {/* Map Container with Filter Panel */}
        <div className="relative flex">
          {/* Main Map */}
          <div className="flex-1 relative">
            {/* Top Controls */}
            <div className="absolute top-4 left-4 z-[1000] space-x-2 flex">
              <Button
                onClick={fetchReports}
                variant="outline"
                size="sm"
                className="bg-background/90 backdrop-blur-sm"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={toggleHeatmap}
                variant={showHeatmap ? "default" : "outline"}
                size="sm"
                className="bg-background/90 backdrop-blur-sm"
              >
                {showHeatmap ? <EyeOff className="w-4 h-4 mr-2" /> : <Thermometer className="w-4 h-4 mr-2" />}
                {showHeatmap ? 'Hide Heatmap' : 'Heatmap'}
              </Button>
            </div>
            
            <div 
              ref={mapRef} 
              className="w-full h-[400px] md:h-[500px] lg:h-[600px] rounded-l-2xl border border-border/50 shadow-card"
              style={{ borderTopRightRadius: isFilterPanelOpen ? 0 : '1rem', borderBottomRightRadius: isFilterPanelOpen ? 0 : '1rem' }}
            />
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="text-xs font-medium text-foreground mb-2">Legend:</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-destructive rounded-full"></div>
                  <span className="text-muted-foreground">New Issues</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-civic-orange rounded-full"></div>
                  <span className="text-muted-foreground">In Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-civic-green rounded-full"></div>
                  <span className="text-muted-foreground">Resolved</span>
                </div>
              </div>
            </div>

            {/* Loading overlay */}
            {isLoading && reports.length === 0 && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-2xl flex items-center justify-center z-[1001]">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-muted-foreground">Loading reports...</span>
                </div>
              </div>
            )}

            {/* Filter Panel Toggle (Mobile) */}
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className="absolute top-4 right-4 z-[1000] md:hidden bg-background/90 backdrop-blur-sm rounded-lg p-2 border border-border/50"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Category Filter Panel (Right Side) */}
          <div 
            className={`
              ${isFilterPanelOpen ? 'w-48 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
              transition-all duration-300 ease-in-out
              bg-background/95 backdrop-blur-sm border border-l-0 border-border/50 rounded-r-2xl
              hidden md:block
            `}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Filter</span>
                </div>
                <button 
                  onClick={() => setIsFilterPanelOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                {CATEGORIES.map(category => {
                  const isActive = activeFilters.has(category.id);
                  const count = reports.filter(r => matchCategory(r.issueType, category.id)).length;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleFilter(category.id)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm
                        transition-all duration-200
                        ${isActive 
                          ? 'bg-primary/10 text-primary border border-primary/30' 
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                        }
                      `}
                    >
                      <span>{category.label}</span>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 min-w-[24px]">
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              
              {activeFilters.size > 0 && (
                <button
                  onClick={() => setActiveFilters(new Set())}
                  className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Collapsed Filter Toggle (Desktop) */}
          {!isFilterPanelOpen && (
            <button
              onClick={() => setIsFilterPanelOpen(true)}
              className="hidden md:flex absolute top-4 right-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/50 items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Filter className="w-4 h-4" />
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile Filter Panel (Bottom Sheet Style) */}
        <div className={`
          md:hidden fixed inset-x-0 bottom-0 z-[2000] bg-background border-t border-border/50 rounded-t-2xl shadow-lg
          transition-transform duration-300 ease-in-out
          ${isFilterPanelOpen ? 'translate-y-0' : 'translate-y-full'}
        `}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filter by Category</span>
              </div>
              <button 
                onClick={() => setIsFilterPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(category => {
                const isActive = activeFilters.has(category.id);
                const count = reports.filter(r => matchCategory(r.issueType, category.id)).length;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => toggleFilter(category.id)}
                    className={`
                      flex items-center justify-between px-3 py-2 rounded-lg text-sm
                      transition-all duration-200
                      ${isActive 
                        ? 'bg-primary/10 text-primary border border-primary/30' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                      }
                    `}
                  >
                    <span>{category.label}</span>
                    <Badge variant="secondary" className="text-xs px-1.5">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
            
            {activeFilters.size > 0 && (
              <button
                onClick={() => setActiveFilters(new Set())}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Selected Report Details */}
        {selectedReport && (
          <Card className="mt-8 bg-gradient-card border border-border/50 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Selected Report Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium text-foreground capitalize">{formatIssueType(selectedReport.type)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline" className="mt-1">
                  {getStatusDisplay(selectedReport.status).label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Severity</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {selectedReport.severity}
                </Badge>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Custom tooltip styles */}
      <style>{`
        .map-tooltip {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .map-tooltip::before {
          border-top-color: #e2e8f0 !important;
        }
        .leaflet-tooltip-top::before {
          border-top-color: white !important;
        }
        .map-marker-icon:hover {
          transform: scale(1.2);
        }
      `}</style>
    </section>
  );
};

export default CitizenMap;