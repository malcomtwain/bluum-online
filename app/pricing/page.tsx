"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { useUserPlanStore } from "@/store/userPlanStore";

const basicMonthlyPrice = 29;
const proMonthlyPrice = 79;
const businessMonthlyPrice = 199;

const basicYearlyPrice = 279;
const proYearlyPrice = 759;
const businessYearlyPrice = 1919;

export default function PricingPage() {
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { plan } = useUserPlanStore();

  const isBasicPlan = plan === 'basic';
  const isProfessionalPlan = plan === 'professional';
  const isBusinessPlan = plan === 'business';

  return (
    <div className="h-[calc(100vh-65px)] w-full overflow-y-auto bg-[#fafafa] dark:bg-[#0e0f15]">
      <div className="max-w-[1400px] mx-auto h-full flex flex-col py-8 px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-[#0a0a0c] dark:text-white">
            Choose Your Plan
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
            Start creating amazing videos today with our flexible pricing options
          </p>
        </div>

        {/* Toggle Billing Period */}
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="flex items-center bg-[#fafafa] dark:bg-[#18181C] border dark:border-[#27272A] rounded-xl p-1 mb-4">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2.5 rounded-lg transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-[#fafafa] text-[#0a0a0c] shadow-lg'
                  : 'text-[#fafafa] hover:bg-[#27272A] hover:text-[#fafafa]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2.5 rounded-lg transition-all ${
                billingPeriod === 'yearly'
                  ? 'bg-[#fafafa] text-[#0a0a0c] shadow-lg'
                  : 'text-[#fafafa] hover:bg-[#27272A] hover:text-[#fafafa]'
              }`}
            >
              Yearly
            </button>
          </div>
          {billingPeriod === 'yearly' && (
            <div className="flex items-center gap-2 text-sm font-medium text-green-500">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save up to 20% with annual billing
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
          {/* Basic Plan */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-2xl overflow-hidden border dark:border-[#27272A] transition-all hover:shadow-xl">
            <div className="p-8">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Basic</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-bold dark:text-white">
                  ${billingPeriod === 'monthly' ? basicMonthlyPrice : Math.round(basicYearlyPrice / 12)}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">/mo</span>
              </div>
              <Button 
                onClick={() => router.push("/create")}
                className={`w-full py-6 text-base ${
                  isBasicPlan 
                    ? "bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c]" 
                    : "bg-[#fafafa] text-[#0a0a0c] hover:bg-opacity-90"
                } rounded-xl font-medium`}
                disabled={isBasicPlan}
              >
                {isBasicPlan ? "Current Plan" : "Get Started"}
              </Button>
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Up to 50 videos per day</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Basic templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Standard support</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] p-[3px] rounded-2xl relative md:-mt-4">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c] px-3 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>
            <div className="h-full rounded-xl bg-white dark:bg-[#0a0a0c] p-8">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Professional</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-bold dark:text-white">
                  ${billingPeriod === 'monthly' ? proMonthlyPrice : Math.round(proYearlyPrice / 12)}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">/mo</span>
              </div>
              <Button 
                onClick={() => router.push("/create")}
                className={`w-full py-6 text-base ${
                  isProfessionalPlan 
                    ? "bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c]" 
                    : "bg-[#fafafa] text-[#0a0a0c] hover:bg-opacity-90"
                } rounded-xl font-medium`}
                disabled={isProfessionalPlan}
              >
                {isProfessionalPlan ? "Current Plan" : "Get Started"}
              </Button>
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Up to 200 videos per day</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Premium templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Advanced analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Custom branding</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Business Plan */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-2xl overflow-hidden border dark:border-[#27272A] transition-all hover:shadow-xl">
            <div className="p-8">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Business</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-bold dark:text-white">
                  ${billingPeriod === 'monthly' ? businessMonthlyPrice : Math.round(businessYearlyPrice / 12)}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">/mo</span>
              </div>
              <Button 
                onClick={() => router.push("/create")}
                className={`w-full py-6 text-base ${
                  isBusinessPlan 
                    ? "bg-gradient-to-r from-[#f8d4eb] via-[#ce7acb] to-[#e9bcba] text-[#0a0a0c]" 
                    : "bg-[#fafafa] text-[#0a0a0c] hover:bg-opacity-90"
                } rounded-xl font-medium`}
                disabled={isBusinessPlan}
              >
                {isBusinessPlan ? "Current Plan" : "Get Started"}
              </Button>
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Unlimited videos per day</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">All premium features</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">24/7 priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">API access</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-[#ce7acb] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-300">Custom integrations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 