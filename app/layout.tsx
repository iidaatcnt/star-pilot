import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "STAR PILOT: HAND_LINK",
    description: "Navigate through space with your hand gestures.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body style={{ margin: 0, padding: 0, overflow: 'hidden', background: '#000' }}>
                {children}
            </body>
        </html>
    );
}
