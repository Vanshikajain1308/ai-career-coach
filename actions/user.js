// actions/user.js
"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";

export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // Step 1: Check if industryInsight exists (outside transaction for speed)
    let existingInsight = await db.industryInsight.findUnique({
      where: { industry: data.industry },
    });

    let insights = null;
    if (!existingInsight) {
      // Generate AI insights OUTSIDE the transaction (to avoid timeout)
      insights = await generateAIInsights(data.industry);
      console.log("Generated insights:", insights);  // Debug: Check for invalid keys
    }

    // Step 2: Use transaction only for DB operations (faster, less prone to timeout)
    const result = await db.$transaction(
      async (tx) => {
        let industryInsight = existingInsight;

        if (!industryInsight && insights) {
          // Normalize demandLevel to match Demandlevel enum (HIGH, MEDIUM, LOW)
          const normalizedDemandLevel = (() => {
            const level = insights.demandLevel?.toUpperCase();
            return level === "HIGH" || level === "MEDIUM" || level === "LOW" ? level : "MEDIUM";
          })();

          // Normalize marketOutlook to match MarketOutLook enum (POSITIVE, NEUTRAL, NEGATIVE)
          const normalizedMarketOutlook = (() => {
            const outlook = insights.marketOutlook?.toUpperCase();
            return outlook === "POSITIVE" || outlook === "NEUTRAL" || outlook === "NEGATIVE" ? outlook : "NEUTRAL";
          })();

          industryInsight = await tx.industryInsight.create({
            data: {
              industry: data.industry,
              salaryRanges: insights.salaryRanges || [],
              growthRate: insights.growthRate || 0.0,
              demandLevel: normalizedDemandLevel,  // Normalized for Demandlevel enum
              topSkills: insights.topSkills || [],
              marketOutlook: normalizedMarketOutlook,  // Normalized for MarketOutLook enum
              keyTrends: insights.keyTrends || [],
              recommendedSkills: insights.recommendedSkills || [],
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        }

        // Update user
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            industry: data.industry,
            experience: data.experience,
            bio: data.bio,
            skills: data.skills,
          },
        });

        return {success:true, updatedUser, industryInsight };
      },
      { timeout: 50000 }  // Keep your increased timeout as a safety net
    );

    revalidatePath("/");
    return result.updatedUser;
  } catch (error) {
    console.error("Error updating user and industry:", error.message);
    throw new Error("Failed to update profile");
  }
}

// getUserOnboardingStatus remains unchanged
export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true },
  });

  return { isOnboarded: Boolean(user?.industry) };
}
