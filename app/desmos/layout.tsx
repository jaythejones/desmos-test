export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <head>
        <script src="https://www.desmos.com/api/v1.11.3/calculator.js?apiKey=f6c2c8deef9e465b85041e9b19af02e5" />
      </head>
      <body>
        <h3>
          Layout: Desmos script is <b>LOADED</b>
        </h3>
        {children}
      </body>
    </>
  );
}
