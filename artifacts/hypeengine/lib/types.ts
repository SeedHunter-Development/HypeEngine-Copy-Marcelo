export interface Campaign {
  id: string;
  clientId: string;
  title: string;
  description: string;
  hashtag: string;
  postTemplate: string;
  postTemplates?: string[];
  imageUrl?: string;
  totalCredits: number;
  usedCredits: number;
  status: "active" | "completed" | "draft" | "paused";
  trending: boolean;
  createdAt: string;
  metrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
  };
  maxPricePerPost: number;
  maxPostsPerKolPerDay: number;
  maxPostsPerKolTotal: number;
  targetNiches?: string[];
  targetCountries?: string[];
  targetLanguages?: string[];
  campaignGoal?: "conversion" | "awareness" | "community";
  landingPageUrl?: string;
  ctaText?: string;
  ctaPlacement?: "end_of_tweet" | "replace_in_template";
  aiPersonalization?: boolean;
  matchScore?: number;
  calculatedPrice?: number;
  matchDimensions?: Record<string, { score: number; weight: number; label: string }>;
  priceBreakdown?: {
    base: number;
    followerTier: number;
    followerTierLabel: string;
    performanceMultiplier: number;
    matchModifier: number;
    reliabilityModifier: number;
    reliabilityLabel: string;
    finalPrice: number;
  };
}

export interface Post {
  id: string;
  campaignId: string;
  kolId: string;
  kolName: string;
  tweetUrl?: string;
  tweetText?: string;
  tweetCreatedAt?: string;
  apifyStatus?: "scanning" | "found" | "not_found";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  metrics: {
    views: number;
    likes: number;
    engagement: number;
  };
  creditsEarned: number;
  postedDate?: string;
}

export interface Transaction {
  id: string;
  type: "deposit" | "spend" | "earn" | "withdraw";
  amount: number;
  description: string;
  createdAt: string;
}
