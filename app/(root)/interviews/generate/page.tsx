import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import GenerateInterviewClient from "./GenerateInterviewClient";

export const metadata: Metadata = {
  title: "Generate interview",
  description: "Create a personalized mock interview plan for your role and stack.",
};

export default async function GenerateInterviewPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  return <GenerateInterviewClient userId={user.id} />;
}
