import { Button } from "@/components/ui/button";
import GovernmentTopBar from "@/components/GovernmentTopBar";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { Shield, Users, Award, MapPin, ArrowRight, Activity, FileText, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useRef } from "react";

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const yText = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacityText = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const handleContinue = () => {
    navigate('/signin');
  };

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen relative overflow-hidden font-sans text-slate-800 bg-[#0B1120]">
      {/* Dynamic Abstract Background */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(17,24,39,1),_rgba(11,17,32,1))]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

        {/* Subtle Moving Orbs */}
        <motion.div
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 30, 0], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-teal-900/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <GovernmentTopBar variant="transparent" />

        <main className="flex-grow container mx-auto px-4 py-12 flex flex-col items-center justify-center">

          {/* Hero Section */}
          <motion.div
            style={{ y: yText, opacity: opacityText }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-20 max-w-5xl mx-auto"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center justify-center p-2 mb-8 bg-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-lg"
            >
              <Shield className="w-5 h-5 text-emerald-400 mr-2" />
              <span className="text-emerald-400 font-medium text-sm tracking-wide uppercase">Official Citizen Portal</span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-6xl md:text-8xl font-bold text-white mb-8 tracking-tight leading-[1.1]"
            >
              {t("app_name")} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Nagarsewa</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed font-light"
            >
              {t("tagline")} A seamless bridge between you and your government. Report, track, and resolve civic issues with transparency.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Button
                onClick={handleContinue}
                size="lg"
                className="bg-[#4FD1C5] hover:bg-[#38b2ac] text-[#0A192F] px-10 py-7 text-lg font-bold rounded-full shadow-[0_0_30px_rgba(79,209,197,0.3)] transition-all hover:scale-105"
              >
                {t("continue")} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <div className="hidden sm:block">
                <LanguageSwitcher className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white" />
              </div>
            </motion.div>
          </motion.div>

          {/* Bento Grid Layout */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl"
          >
            {/* Large Card - Report */}
            <motion.div variants={fadeInUp} className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-10 h-full flex flex-col justify-between relative z-10">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
                    <MapPin className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-3">Report Issues Instantly</h3>
                  <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                    Spot a pothole, broken streetlight, or garbage pile? Snap a photo, drop a pin, and report it in seconds.
                  </p>
                </div>
                <div className="mt-10 flex items-center text-emerald-400 font-semibold text-lg group-hover:translate-x-2 transition-transform cursor-pointer">
                  Start Reporting <ArrowRight className="ml-2 w-5 h-5" />
                </div>
              </div>
            </motion.div>

            {/* Tall Card - Stats */}
            <motion.div variants={fadeInUp} className="md:row-span-2 group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-10 h-full flex flex-col relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                  <Activity className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-6">Live Impact</h3>
                <div className="space-y-8 flex-grow">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-white mb-1">1,240+</div>
                    <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">Issues Resolved</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-white mb-1">98%</div>
                    <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">Response Rate</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="text-4xl font-bold text-white mb-1">24h</div>
                    <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">Avg. Turnaround</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Medium Card - Track */}
            <motion.div variants={fadeInUp} className="group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-10 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
                  <FileText className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Track Status</h3>
                <p className="text-slate-400 leading-relaxed">
                  Real-time updates on your reports. Know exactly when it's fixed.
                </p>
              </div>
            </motion.div>

            {/* Medium Card - Community */}
            <motion.div variants={fadeInUp} className="group relative overflow-hidden rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-10 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Community</h3>
                <p className="text-slate-400 leading-relaxed">
                  Join 50,000+ citizens making their city better together.
                </p>
              </div>
            </motion.div>

          </motion.div>

          {/* Trust Section */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 1 }}
            className="mt-32 text-center pb-10"
          >
            <p className="text-slate-500 text-xs uppercase tracking-[0.2em] mb-8">Trusted by Municipal Corporations Across India</p>
            <div className="flex flex-wrap justify-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
              {/* Placeholders for logos - using text for now */}
              <div className="text-2xl font-bold text-white">VMC</div>
              <div className="text-2xl font-bold text-white">AMC</div>
              <div className="text-2xl font-bold text-white">SMC</div>
              <div className="text-2xl font-bold text-white">RMC</div>
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
};

export default Landing;
