import './globals.css';

export const metadata = {
  title: 'Cajón a Cajón',
  description: 'Gestión de venta mayorista de huevos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
