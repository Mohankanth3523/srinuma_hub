import { notFound } from "next/navigation";
import DatabaseClient from "./test-client";
export default function DatabaseSetupPage() {
  // Internal test page is never deployed in production.
  if (process.env.NODE_ENV !== "development") notFound();
  return <DatabaseClient />;
}
