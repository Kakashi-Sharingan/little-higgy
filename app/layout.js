import './globals.css';
import './little-higgy.css';

export const metadata = {
  title: 'Little Higgy — Your Personal Creative Studio',
  description: 'A personal creative studio powered by local ComfyUI models. No API key or provider credits.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
