
import { jsPDF } from "jspdf";

export interface TaxBill {
    id: string;
    propertyName: string;
    ownerName: string;
    amount: number;
    billingPeriod: string;
    dueDate: string;
    status: 'unpaid' | 'paid' | 'partial';
}

export interface Transaction {
    id: string;
    date: Date;
    taxId: string;
    originalAmount: number;
    pointsRedeemed: number;
    discountAmount: number;
    finalAmount: number;
    status: 'success' | 'failed';
}

// Mock Database
const MOCK_TAX_BILLS: TaxBill[] = [
    { id: 'VMS-2025-001', propertyName: 'Residential Flat 101, Alkapuri', ownerName: 'Rajesh Kumar', amount: 1500, billingPeriod: '2025-Q1', dueDate: '2025-03-31', status: 'unpaid' },
    { id: 'VMS-2025-002', propertyName: 'Shop 12, Main Market', ownerName: 'Suresh Patel', amount: 4500, billingPeriod: '2025-Q1', dueDate: '2025-03-31', status: 'unpaid' },
    { id: 'VMS-2025-003', propertyName: 'Plot 45, Gotri Road', ownerName: 'Amit Shah', amount: 2200, billingPeriod: '2025-Q1', dueDate: '2025-03-31', status: 'unpaid' },
    { id: 'VMS-2024-004', propertyName: 'Old House, Mandvi', ownerName: 'Meena Ben', amount: 800, billingPeriod: '2024-Q4', dueDate: '2024-12-31', status: 'unpaid' },
    { id: 'VMS-2024-005', propertyName: 'Office 304, Sayaji Tower', ownerName: 'Vikram Singh', amount: 3500, billingPeriod: '2024-Q4', dueDate: '2024-12-31', status: 'unpaid' },
    { id: 'VMS-2024-006', propertyName: 'Garage, Makarpura', ownerName: 'John Doe', amount: 1200, billingPeriod: '2024-Q4', dueDate: '2024-12-31', status: 'unpaid' }
];

const transactions: Transaction[] = [];

export const taxService = {
    // 1. Fetch Tax Data
    fetchTaxDetails: async (taxId: string): Promise<TaxBill | null> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        return MOCK_TAX_BILLS.find(b => b.id === taxId) || null;
    },

    // 2. Verify OTP (Mock)
    verifyOTP: async (otp: string): Promise<boolean> => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return otp === '1234';
    },

    // 3. Process Payment with Point Redemption
    payTax: async (taxId: string, pointsToRedeem: number, pointRate: number = 10): Promise<Transaction | null> => {
        const bill = MOCK_TAX_BILLS.find(b => b.id === taxId);
        if (!bill) return null;

        const discount = pointsToRedeem * pointRate;
        const finalAmount = Math.max(0, bill.amount - discount);

        const transaction: Transaction = {
            id: `TXN-${Date.now()}`,
            date: new Date(),
            taxId: bill.id,
            originalAmount: bill.amount,
            pointsRedeemed: pointsToRedeem,
            discountAmount: discount,
            finalAmount: finalAmount,
            status: 'success'
        };

        transactions.push(transaction);

        // Update mock bill status
        bill.status = finalAmount === 0 ? 'paid' : 'partial';

        return transaction;
    },

    // 4. Generate PDF
    generateReceipt: (transaction: Transaction, bill: TaxBill) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(41, 128, 185); // Civic Blue
        doc.text("Nagar Seva - Tax Payment Receipt", 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Vadodara Municipal Corporation", 105, 26, { align: 'center' });
        doc.line(20, 30, 190, 30); // Horizontal line

        // Transaction Details
        doc.setTextColor(0);
        doc.setFontSize(12);

        let y = 45;
        const addRow = (label: string, value: string) => {
            doc.text(label, 25, y);
            doc.text(value, 180, y, { align: 'right' });
            y += 10;
        };

        doc.setFont("helvetica", "bold");
        doc.text("Payment Details", 20, y - 5);
        y += 5;
        doc.setFont("helvetica", "normal");

        addRow("Transaction ID:", transaction.id);
        addRow("Date:", transaction.date.toLocaleString());
        addRow("Tax ID:", bill.id);
        addRow("Property:", bill.propertyName);
        addRow("Billing Period:", bill.billingPeriod);

        y += 5;
        doc.line(20, y, 190, y);
        y += 10;

        // Financials
        addRow("Original Bill Amount:", `Rs. ${transaction.originalAmount}`);
        addRow("Points Redeemed:", `${transaction.pointsRedeemed} pts`);
        addRow("Discount Applied:", `- Rs. ${transaction.discountAmount}`);

        y += 5;
        doc.setFont("helvetica", "bold");
        addRow("Final Paid Amount:", `Rs. ${transaction.finalAmount}`);

        // Footer
        y += 20;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Thank you for contributing to a better city.", 105, y, { align: 'center' });
        doc.text("This is an electronically generated receipt.", 105, y + 6, { align: 'center' });

        doc.save(`TaxReceipt_${transaction.taxId}.pdf`);
    },

    getTransactionHistory: () => {
        return [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
    }
};
