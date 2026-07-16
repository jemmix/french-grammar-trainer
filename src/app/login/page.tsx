import { env } from "~/next/env";
import LoginClient from "./login-client";

export default function LoginPage() {
  return <LoginClient authEngine={env.AUTH_ENGINE} />;
}
