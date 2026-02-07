-- ================================================
-- NOTIFICATIONS SYSTEM - DATABASE SCHEMA
-- ================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES civic_reports(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ================================================
-- NOTIFICATION TRIGGERS
-- ================================================

-- 5. Trigger Function: Report Submitted
CREATE OR REPLACE FUNCTION notify_report_submitted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, report_id, type, title, message, metadata)
  VALUES (
    NEW.user_id,
    NEW.id,
    'report_submitted',
    'Report Submitted Successfully',
    'Your ' || COALESCE(NEW.issue_type, 'civic issue') || ' report has been submitted and is being reviewed.',
    jsonb_build_object('issue_type', NEW.issue_type, 'location', NEW.location)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_report_submitted ON civic_reports;
CREATE TRIGGER on_report_submitted
  AFTER INSERT ON civic_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_submitted();

-- 6. Trigger Function: Status Changes
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'verified' THEN
        notification_type := 'report_verified';
        notification_title := 'Report Verified ✓';
        notification_message := 'Great news! Your ' || COALESCE(NEW.issue_type, 'report') || ' has been verified by an authorizer and forwarded to the department.';
      
      WHEN 'in_progress' THEN
        notification_type := 'report_in_progress';
        notification_title := 'Department Working on Your Report';
        notification_message := 'The department is actively working on resolving your ' || COALESCE(NEW.issue_type, 'report') || '.';
      
      WHEN 'resolved' THEN
        notification_type := 'report_resolved';
        notification_title := 'Report Resolved! 🎉';
        notification_message := 'Your ' || COALESCE(NEW.issue_type, 'report') || ' has been successfully resolved. Thank you for making your community better!';
      
      WHEN 'rejected' THEN
        notification_type := 'report_rejected';
        notification_title := 'Report Rejected';
        notification_message := 'Your ' || COALESCE(NEW.issue_type, 'report') || ' was rejected. Please check the report details for more information.';
      
      ELSE
        -- For other status changes, don't create notification
        RETURN NEW;
    END CASE;
    
    INSERT INTO notifications (user_id, report_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      NEW.id,
      notification_type,
      notification_title,
      notification_message,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'issue_type', NEW.issue_type)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_report_status_change ON civic_reports;
CREATE TRIGGER on_report_status_change
  AFTER UPDATE ON civic_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_change();

-- 7. Trigger Function: Points Awarded (Enhanced from existing)
CREATE OR REPLACE FUNCTION notify_points_awarded()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER;
BEGIN
  -- Calculate points earned
  points_earned := NEW.points - OLD.points;
  
  -- Only notify if points increased
  IF points_earned > 0 THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.id,
      'points_earned',
      'Points Earned! 🌟',
      'You earned ' || points_earned || ' points! Your total is now ' || NEW.points || ' points.',
      jsonb_build_object('points_earned', points_earned, 'total_points', NEW.points)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_points_awarded ON profiles;
CREATE TRIGGER on_points_awarded
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.points > OLD.points)
  EXECUTE FUNCTION notify_points_awarded();

-- ================================================
-- ENABLE REALTIME
-- ================================================

-- 8. Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- 9. Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE
  WHERE id = notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = auth.uid() AND read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = auth.uid() AND read = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- COMPLETE
-- ================================================

COMMENT ON TABLE notifications IS 'Stores user notifications for report lifecycle events';
COMMENT ON FUNCTION notify_report_submitted() IS 'Creates notification when a new report is submitted';
COMMENT ON FUNCTION notify_status_change() IS 'Creates notification when report status changes';
COMMENT ON FUNCTION notify_points_awarded() IS 'Creates notification when user earns points';
