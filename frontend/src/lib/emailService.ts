import emailjs from '@emailjs/browser';
import { toast } from "@/hooks/use-toast";

// EmailJS Configuration
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_vk0kpmf";
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_yzazn4s";
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "GOhHmCBQlQZOLIFc_";

console.log("📧 EmailJS Config:", {
    serviceId: SERVICE_ID ? "Loaded" : "Missing",
    templateId: TEMPLATE_ID ? "Loaded" : "Missing",
    publicKey: PUBLIC_KEY ? "Loaded" : "Missing" // Should not be missing now due to fallback
});

export const emailService = {
    sendResolutionEmail: async (recipientEmail: string, reportId: string, citizenName: string, resolutionNotes: string) => {
        try {
            const templateParams = {
                to_email: recipientEmail,   // MATCHES SCREENSHOT: {{to_email}}
                report_id: reportId,        // MATCHES SCREENSHOT: {{report_id}}

                // Since the template body is just {{message}}, we build the full email content here
                message: `Dear ${citizenName},

We are delighted to inform you that the specific civic issue you reported (ID: ${reportId}) has been successfully RESOLVED by the department!

As a token of appreciation for your active citizenship, you have been awarded 50 Points.

Resolution Notes:
"${resolutionNotes}"

Thank you for helping make our city better!
- Team NagarSeva`,
            };

            await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

            toast({
                title: "📧 Email Sent to Citizen",
                description: `Notification sent to ${recipientEmail}`,
            });
        } catch (error) {
            console.error("FAILED to send email via EmailJS:", error);
            toast({
                title: "Email Delivery Failed",
                description: "Could not send resolution email. Check console for details.",
                variant: "destructive",
            });
        }
    },

    sendRedirectNotification: async (recipientEmail: string, reportId: string, newDeptName: string) => {
        // Optional: Implement redirect notification if needed
        console.log(`📧 Notification: Report ${reportId} accepted by ${newDeptName}. (EmailJS not configured for this yet)`);
    },

    sendCertificateEmail: async (recipientEmail: string, citizenName: string, certificate: any) => {
        try {
            const templateParams = {
                to_email: recipientEmail,
                to_name: citizenName,
                certificate_title: certificate.title,
                certificate_id: certificate.code, // Using code as ID for display
                issue_date: new Date(certificate.date).toLocaleDateString(),
                message: `Congratulations ${citizenName},

This is an official acknowledgment of your civic contributions.
Based on your verified activity, you have been awarded the "${certificate.title}".

Certificate ID: ${certificate.code}
Date Issued: ${new Date(certificate.date).toLocaleDateString()}

This certificate represents your commitment to bettering our city and may be considered for applicable municipal benefits.

You can view and download this certificate from your profile.

Sincerely,
Municipal Administration`
            };

            // Using the same service/template for now, typically would use a specific template
            // Assuming the generic template has a {{message}} field
            await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

            toast({
                title: "🏅 Certificate Issued",
                description: `Confirmation email sent to ${recipientEmail}`,
            });
        } catch (error) {
            console.error("FAILED to send certificate email:", error);
            // Don't block UI flow for email error
        }
    }
};
