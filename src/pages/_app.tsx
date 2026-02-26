import { type AppType } from "next/dist/shared/lib/utils";
import { Geist } from "next/font/google";

import "~/styles/globals.css";
import { ProgressProvider } from "~/contexts/progress-context";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={geist.className}>
      <ProgressProvider>
        <Component {...pageProps} />
      </ProgressProvider>
    </div>
  );
};

export default MyApp;
