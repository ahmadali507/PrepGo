"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Briefcase,
  Layers,
  MessageSquare,
  Mic,
} from "lucide-react";
import {
  useState,
  FormEvent,
  ChangeEvent,
  useTransition,
} from "react";
import { generateInterview } from "@/lib/actions/general.action";
import type { InterviewSessionMode } from "@/lib/utils";
import {
  ThemedSelect,
  themedSelectOptionClass,
} from "@/components/ui/themed-select";

interface GenerateInterviewClientProps {
  userId: string;
}

interface FormData {
  role: string;
  type: string;
  level: string;
  amount: string;
  techstack: string;
  sessionMode: InterviewSessionMode;
}

const initialForm: FormData = {
  role: "",
  type: "mix",
  level: "entry",
  amount: "3",
  techstack: "",
  sessionMode: "vapi",
};

export default function GenerateInterviewClient({
  userId,
}: GenerateInterviewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialForm);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const techArray = formData.techstack
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    startTransition(() => {
      setLoading(true);
      generateInterview({
        userId,
        role: formData.role,
        level: formData.level,
        type: formData.type,
        amount: Number(formData.amount) || 3,
        techstack: techArray,
        sessionMode: formData.sessionMode,
      })
        .then((result) => {
          if (!result?.success) {
            setError(
              result?.error || "Unable to generate interview. Please try again."
            );
            return;
          }
          router.push("/interviews");
          router.refresh();
        })
        .catch(() => {
          setError("Unexpected error generating interview. Please try again.");
        })
        .finally(() => {
          setLoading(false);
        });
    });
  };

  const busy = loading || isPending;

  return (
    <div className="min-h-screen pb-16 pt-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link
            href="/interviews"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to interviews
          </Link>

          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Generate
              </span>{" "}
              a mock interview
            </h1>
            <p className="mt-3 max-w-xl text-lg text-gray-400">
              Tell us the role, stack, and format. We&apos;ll build a tailored
              question plan you can practice in the browser or over voice.
            </p>
          </div>

          {error && (
            <div className="mb-8 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm text-red-300/90">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Role & stack
                  </h2>
                  <p className="text-sm text-gray-500">
                    What are you interviewing for?
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="role"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Job role <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="role"
                    name="role"
                    type="text"
                    required
                    placeholder="e.g. Frontend Developer, Data Scientist"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="techstack"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Technologies / skills <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="techstack"
                    name="techstack"
                    type="text"
                    required
                    placeholder="e.g. React, TypeScript, Node.js — comma separated"
                    value={formData.techstack}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Interview shape
                  </h2>
                  <p className="text-sm text-gray-500">
                    Type, level, and how many questions to generate.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="type"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Interview type
                  </label>
                  <ThemedSelect
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleSelectChange}
                  >
                    <option className={themedSelectOptionClass} value="technical">
                      Technical
                    </option>
                    <option className={themedSelectOptionClass} value="behavioral">
                      Behavioral
                    </option>
                    <option className={themedSelectOptionClass} value="mix">
                      Mixed
                    </option>
                  </ThemedSelect>
                </div>

                <div>
                  <label
                    htmlFor="level"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Experience level
                  </label>
                  <ThemedSelect
                    id="level"
                    name="level"
                    value={formData.level}
                    onChange={handleSelectChange}
                  >
                    <option className={themedSelectOptionClass} value="entry">
                      Entry
                    </option>
                    <option className={themedSelectOptionClass} value="junior">
                      Junior
                    </option>
                    <option className={themedSelectOptionClass} value="mid">
                      Mid-level
                    </option>
                    <option className={themedSelectOptionClass} value="senior">
                      Senior
                    </option>
                  </ThemedSelect>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="amount"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Number of questions
                  </label>
                  <ThemedSelect
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleSelectChange}
                    className="max-w-md"
                  >
                    {[2, 3, 5, 7, 10].map((num) => (
                      <option
                        key={num}
                        className={themedSelectOptionClass}
                        value={String(num)}
                      >
                        {num} questions
                      </option>
                    ))}
                  </ThemedSelect>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Practice format
                  </h2>
                  <p className="text-sm text-gray-500">
                    Text chat in the app, or voice with Vapi.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-5 transition ${
                    formData.sessionMode === "simple"
                      ? "border-purple-400/50 bg-purple-500/10 ring-2 ring-purple-500/20"
                      : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="sessionMode"
                      value="simple"
                      checked={formData.sessionMode === "simple"}
                      onChange={() =>
                        setFormData((p) => ({ ...p, sessionMode: "simple" }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <span className="flex items-center gap-2 font-semibold text-white">
                        <MessageSquare className="h-4 w-4 text-purple-300" />
                        Text session
                      </span>
                      <p className="mt-1 text-sm text-gray-400">
                        Typed mock interview in the browser.
                      </p>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-5 transition ${
                    formData.sessionMode === "vapi"
                      ? "border-purple-400/50 bg-purple-500/10 ring-2 ring-purple-500/20"
                      : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="sessionMode"
                      value="vapi"
                      checked={formData.sessionMode === "vapi"}
                      onChange={() =>
                        setFormData((p) => ({ ...p, sessionMode: "vapi" }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <span className="flex items-center gap-2 font-semibold text-white">
                        <Mic className="h-4 w-4 text-cyan-300" />
                        Voice (Vapi)
                      </span>
                      <p className="mt-1 text-sm text-gray-400">
                        AI voice interviewer for realistic practice.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
              <Link
                href="/interviews"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-6 py-3 text-center font-medium text-gray-300 transition hover:bg-white/5"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-3 font-semibold text-white shadow-lg transition hover:shadow-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate interview
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
