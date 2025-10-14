"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export default function AuthPage() {
  const pathname = usePathname();
  const isSignUp = pathname?.includes("/sign-up");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-6">
        {isSignUp ? <SignUp /> : <SignIn />}
      </div>
    </div>
  );
} 