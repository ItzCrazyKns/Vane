const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="lg:pl-20 bg-primaryLight dark:bg-primaryDark min-h-screen">
      <div className="max-w-screen-lg lg:mx-auto mx-4">{children}</div>
    </main>
  );
};

export default Layout;
