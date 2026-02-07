-- 1. Add Columns for Resolution Details
ALTER TABLE civic_reports 
ADD COLUMN IF NOT EXISTS resolution_duration text,
ADD COLUMN IF NOT EXISTS resolution_date timestamp with time zone;

-- 2. Create Trigger Function for Points
CREATE OR REPLACE FUNCTION public.award_points_on_resolve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only award points if status changes to 'resolved' from something else
  IF (OLD.status IS DISTINCT FROM 'resolved' AND NEW.status = 'resolved') THEN
    -- Update the user's points (Citizen)
    UPDATE public.profiles
    SET points = COALESCE(points, 0) + 30
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_award_points ON civic_reports;
CREATE TRIGGER trigger_award_points
  AFTER UPDATE ON civic_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.award_points_on_resolve();

-- 4. RLS Policy Updates (Strengthen Access Control)
-- Enable RLS on reports if not already
ALTER TABLE civic_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Citizens can see their own reports
DROP POLICY IF EXISTS "Citizens view own reports" ON civic_reports;
CREATE POLICY "Citizens view own reports"
ON civic_reports FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Departments can see reports assigned to them
DROP POLICY IF EXISTS "Departments view assigned reports" ON civic_reports;
CREATE POLICY "Departments view assigned reports"
ON civic_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'department'
    AND profiles.dept_id = civic_reports.assigned_dept_id
  )
);

-- Policy: Department can update their assigned reports (to resolve them)
DROP POLICY IF EXISTS "Departments update assigned reports" ON civic_reports;
CREATE POLICY "Departments update assigned reports"
ON civic_reports FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'department'
    AND profiles.dept_id = civic_reports.assigned_dept_id
  )
);

-- Policy: Citizens can insert reports
DROP POLICY IF EXISTS "Citizens insert reports" ON civic_reports;
CREATE POLICY "Citizens insert reports"
ON civic_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);
