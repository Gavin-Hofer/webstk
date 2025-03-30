import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Image Converter | WebSTK',
  description: 'Fully client-side image converter.',
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export default Layout;
