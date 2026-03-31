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
  status: "active" | "completed" | "draft";
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
}

export interface Post {
  id: string;
  campaignId: string;
  kolId: string;
  kolName: string;
  tweetUrl?: string;
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
  userId: string;
  type: "deposit" | "spend" | "earn" | "withdraw";
  amount: number;
  description: string;
  createdAt: string;
}

export interface ServerUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: "client" | "kol" | "admin";
  companyName?: string;
  title?: string;
  twitterAccount?: string;
  website?: string;
  followers?: number;
  kolValue?: number;
  credits: number;
  setupComplete: boolean;
  agreedToTerms?: boolean;
  walletConnected?: boolean;
  bio?: string;
  country?: string;
  language?: string;
  niches?: string[];
  twitterFollowers?: number;
  twitterFollowing?: number;
}

interface Store {
  users: ServerUser[];
  campaigns: Campaign[];
  posts: Post[];
  transactions: Transaction[];
}

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: "camp-1",
    clientId: "demo-client",
    title: "MetaVerse Launch Campaign",
    description: "Help spread the word about the biggest metaverse launch of 2025. Share with your crypto community and earn rewards!",
    hashtag: "#HE_MetaVerse",
    postTemplate: "🚀 The future of the metaverse is HERE! @MetaVerse2025 is launching and it's going to change everything we know about virtual worlds.\n\nDon't miss out on the biggest crypto event of 2025. Early access available now! 🌐\n\n#HE_MetaVerse #Crypto #Web3 #Metaverse",
    postTemplates: [
      "🚀 The future of the metaverse is HERE! @MetaVerse2025 is launching and it's going to change everything we know about virtual worlds.\n\nDon't miss out on the biggest crypto event of 2025. Early access available now! 🌐\n\n#HE_MetaVerse #Crypto #Web3 #Metaverse",
      "I've been watching @MetaVerse2025 for months and I'm finally convinced — this is the real deal 👀\n\nFull VR integration, cross-chain assets, and real ownership of your digital space. This isn't hype. This is the future.\n\nEarly access is LIVE 🔗\n#HE_MetaVerse #Web3 #Metaverse",
      "The metaverse failed before because it wasn't truly decentralized.\n\n@MetaVerse2025 fixes this:\n✅ Own your land on-chain\n✅ Cross-game asset portability\n✅ True digital sovereignty\n✅ No platform lock-in\n\nThis is what we've been waiting for 🌐\n#HE_MetaVerse #Crypto #NFT",
      "Just got early access to @MetaVerse2025 and wow — the experience is unlike anything I've seen in Web3.\n\nIf you're serious about the future of digital worlds, you need to get in on this before the public launch 🚀\n\nDrop a 🌐 if you want the link!\n#HE_MetaVerse #Web3Gaming #Metaverse",
    ],
    totalCredits: 5000,
    usedCredits: 3750,
    status: "active",
    trending: true,
    createdAt: "2026-03-01T10:00:00Z",
    metrics: { views: 125000, likes: 8400, replies: 1200, reposts: 3300 },
    maxPricePerPost: 50,
    maxPostsPerKolPerDay: 2,
    maxPostsPerKolTotal: 5,
    targetNiches: ["Metaverse", "Web3", "Crypto"],
    targetCountries: ["Japan", "South Korea", "Singapore"],
    targetLanguages: ["Korean", "Japanese", "English"],
  },
  {
    id: "camp-2",
    clientId: "demo-client",
    title: "DeFi Protocol Awareness",
    description: "Raise awareness for our revolutionary DeFi protocol that's making decentralized finance accessible to everyone.",
    hashtag: "#HE_DeFi",
    postTemplate: "💰 DeFi is evolving and @DecentraFi is leading the charge!\n\nThe protocol making decentralized finance accessible to everyone. APY up to 45% with bank-level security. 🔐\n\nGet in early ↓\n#HE_DeFi #DeFi #Crypto #Web3",
    postTemplates: [
      "💰 DeFi is evolving and @DecentraFi is leading the charge!\n\nThe protocol making decentralized finance accessible to everyone. APY up to 45% with bank-level security. 🔐\n\nGet in early ↓\n#HE_DeFi #DeFi #Crypto #Web3",
      "I don't usually shill protocols but @DecentraFi just hit different 🤯\n\n45% APY isn't the crazy part. The crazy part is it's audited by 3 top firms, non-custodial, and takes 2 minutes to set up.\n\nThis is what DeFi was supposed to be all along.\n#HE_DeFi #Crypto #PassiveIncome",
      "The #1 reason people avoid DeFi: it's too complicated.\n\n@DecentraFi just solved that:\n🟢 One-click liquidity provision\n🟢 Auto-compound rewards\n🟢 Clear risk ratings on every pool\n🟢 $0 minimum to start\n\nDeFi for everyone, finally. 🔓\n#HE_DeFi #Web3 #Crypto",
      "Traditional finance gives you 0.01% on savings.\n@DecentraFi gives you up to 45% APY.\n\nSame security. Same peace of mind. Zero banks.\n\nYour money, your rules. 💪\n\nTry it risk-free with their $0 fee first week →\n#HE_DeFi #DeFi #CryptoInvesting",
    ],
    totalCredits: 3000,
    usedCredits: 1350,
    status: "active",
    trending: false,
    createdAt: "2026-03-05T10:00:00Z",
    metrics: { views: 45000, likes: 3100, replies: 450, reposts: 980 },
    maxPricePerPost: 35,
    maxPostsPerKolPerDay: 1,
    maxPostsPerKolTotal: 3,
    targetNiches: ["DeFi", "Finance", "Investing"],
    targetCountries: ["Germany", "Switzerland", "Austria"],
    targetLanguages: ["German"],
  },
  {
    id: "camp-3",
    clientId: "client-2",
    title: "NFT Collection Drop",
    description: "Promote our exclusive 10K NFT collection. Minting goes live in 48 hours — limited supply, huge demand.",
    hashtag: "#HE_NFTDrop",
    postTemplate: "🎨 Epic NFT drop alert!\n\n@PixelVault just announced their exclusive 10K collection and the art is absolutely FIRE 🔥\n\nMinting goes live in 48 hours. Get on the whitelist NOW before it's too late!\n\nLink in bio 👇\n#HE_NFTDrop #NFT #Web3 #Crypto",
    postTemplates: [
      "🎨 Epic NFT drop alert!\n\n@PixelVault just announced their exclusive 10K collection and the art is absolutely FIRE 🔥\n\nMinting goes live in 48 hours. Get on the whitelist NOW before it's too late!\n\nLink in bio 👇\n#HE_NFTDrop #NFT #Web3 #Crypto",
      "Let me be real — most NFT projects are cash grabs. @PixelVault is different.\n\n🖼️ Generative art by 3 award-winning digital artists\n🏛️ DAO governance from day 1\n💎 Holder royalties on secondary sales\n🎮 In-game utility launching Q2\n\n10K supply. 48hrs left. 👇\n#HE_NFTDrop #NFT #Web3",
      "The @PixelVault NFT collection isn't just art — it's a membership card 🃏\n\nHolders get:\n✨ Access to exclusive IRL events\n✨ Early access to future drops\n✨ 5% of secondary royalties\n✨ Voting rights in the DAO\n\nMinting in 48 hours. Don't sleep on this.\n#HE_NFTDrop #NFTCommunity",
      "I've minted a lot of NFTs. Most gather dust.\n\nBut @PixelVault's 10K drop is different — floor has held on every previous drop and utility is actually being built.\n\nWhitelist spots still available. This won't last. 🔥\n#HE_NFTDrop #NFT #CryptoArt #Web3",
    ],
    totalCredits: 8000,
    usedCredits: 7200,
    status: "active",
    trending: true,
    createdAt: "2026-03-08T10:00:00Z",
    metrics: { views: 280000, likes: 19500, replies: 2800, reposts: 7200 },
    maxPricePerPost: 75,
    maxPostsPerKolPerDay: 3,
    maxPostsPerKolTotal: 10,
    targetNiches: ["NFT", "Art", "Web3"],
    targetCountries: ["United States", "United Kingdom", "Canada"],
    targetLanguages: ["English"],
  },
  {
    id: "camp-4",
    clientId: "client-3",
    title: "Web3 Gaming Alpha",
    description: "Join the alpha test of the most anticipated Web3 game of 2025. Play-to-earn just got a whole lot better.",
    hashtag: "#HE_W3Gaming",
    postTemplate: "🎮 Calling all gamers!\n\n@Nexus3Game is opening alpha access and I got an early invite. The play-to-earn mechanics are genuinely revolutionary.\n\nThis is what Web3 gaming was meant to be 👾\n\nJoin the alpha ↓\n#HE_W3Gaming #Web3Gaming #P2E #Crypto",
    postTemplates: [
      "🎮 Calling all gamers!\n\n@Nexus3Game is opening alpha access and I got an early invite. The play-to-earn mechanics are genuinely revolutionary.\n\nThis is what Web3 gaming was meant to be 👾\n\nJoin the alpha ↓\n#HE_W3Gaming #Web3Gaming #P2E #Crypto",
      "Played @Nexus3Game for 6 hours straight last night. I literally couldn't stop.\n\nAnd I earned $47 in crypto just from playing. No grinding. No pay-to-win. Just actual fun gameplay that happens to pay you.\n\nAlpha access is open NOW 🕹️\n#HE_W3Gaming #P2E #Web3Gaming",
      "Why Web3 gaming keeps failing:\n❌ Bad gameplay, good tokenomics\n\nWhy @Nexus3Game is different:\n✅ Built by ex-AAA devs (Riot, Valve)\n✅ 10M+ traditional gaming fans waiting\n✅ Real economy with skill-based earning\n✅ No wallet required to start\n\nAlpha is live now 🎮\n#HE_W3Gaming #GameFi",
      "The alpha waitlist for @Nexus3Game just opened and spots are filling up fast 👾\n\nIf you're into:\n🎯 Skill-based P2E\n🏆 Competitive leaderboards\n💰 Real crypto rewards\n🌐 True item ownership\n\nGet your invite before it closes.\n#HE_W3Gaming #Web3 #GameFi #Crypto",
    ],
    totalCredits: 2000,
    usedCredits: 600,
    status: "active",
    trending: false,
    createdAt: "2026-03-10T10:00:00Z",
    metrics: { views: 18000, likes: 1200, replies: 180, reposts: 430 },
    maxPricePerPost: 25,
    maxPostsPerKolPerDay: 1,
    maxPostsPerKolTotal: 5,
    targetNiches: ["Gaming", "GameFi", "Entertainment"],
    targetCountries: ["Philippines", "Indonesia", "Malaysia"],
    targetLanguages: ["English", "Indonesian"],
  },
  {
    id: "camp-5",
    clientId: "demo-client",
    title: "Blockchain Summit 2026",
    description: "Promote the biggest blockchain conference of the year. Top speakers, major announcements, global attendance.",
    hashtag: "#HE_BlockchainSummit",
    postTemplate: "📅 Mark your calendars!\n\n@BlockchainSummit2026 is happening in Dubai this April. The biggest names in crypto will be on stage.\n\n🎤 100+ speakers\n🌍 5,000+ attendees\n🚀 Major announcements\n\nGet your tickets before they sell out!\n#HE_BlockchainSummit #Crypto #Web3 #Bitcoin",
    postTemplates: [
      "📅 Mark your calendars!\n\n@BlockchainSummit2026 is happening in Dubai this April. The biggest names in crypto will be on stage.\n\n🎤 100+ speakers\n🌍 5,000+ attendees\n🚀 Major announcements\n\nGet your tickets before they sell out!\n#HE_BlockchainSummit #Crypto #Web3 #Bitcoin",
      "If you're serious about crypto, @BlockchainSummit2026 in Dubai is the ONE event you cannot miss this year.\n\nI've been 3 years in a row. The deals made in hallways here are worth more than any conference ticket price.\n\nApril. Dubai. See you there 🇦🇪\n#HE_BlockchainSummit #Crypto #Web3",
      "The lineup for @BlockchainSummit2026 just dropped and it's STACKED 🔥\n\nWe're talking founders of top 10 protocols, VCs managing $50B+, and regulators from 15 countries.\n\nThis is where crypto's future gets decided.\n\nEarly bird tickets ending soon 🎟️\n#HE_BlockchainSummit #Blockchain #Web3",
      "Networking at @BlockchainSummit2026 last year led directly to 3 of my best investments of 2025.\n\nThis April in Dubai:\n☀️ 5,000+ attendees from 90 countries\n🤝 500+ investors registered\n🚀 20+ project launches\n💡 100+ workshops & panels\n\nDon't miss it 👇\n#HE_BlockchainSummit #Crypto #Bitcoin",
    ],
    totalCredits: 4000,
    usedCredits: 4000,
    status: "completed",
    trending: false,
    createdAt: "2026-02-15T10:00:00Z",
    metrics: { views: 340000, likes: 22000, replies: 3100, reposts: 8900 },
    maxPricePerPost: 45,
    maxPostsPerKolPerDay: 2,
    maxPostsPerKolTotal: 8,
    targetNiches: ["Crypto", "Finance", "Business"],
    targetCountries: ["United Arab Emirates", "United Kingdom", "United States"],
    targetLanguages: ["English"],
  },
];

const INITIAL_POSTS: Post[] = [
  {
    id: "post-1",
    campaignId: "camp-3",
    kolId: "demo-kol",
    kolName: "Sarah Chen",
    tweetUrl: "https://twitter.com/sarahcrypto/status/1234567890",
    status: "approved",
    createdAt: "2026-03-09T14:30:00Z",
    metrics: { views: 12400, likes: 890, engagement: 7.2 },
    creditsEarned: 75,
    postedDate: "2026-03-09",
  },
  {
    id: "post-2",
    campaignId: "camp-1",
    kolId: "demo-kol",
    kolName: "Sarah Chen",
    tweetUrl: "https://twitter.com/sarahcrypto/status/1234567891",
    status: "approved",
    createdAt: "2026-03-02T11:00:00Z",
    metrics: { views: 8200, likes: 540, engagement: 6.6 },
    creditsEarned: 50,
    postedDate: "2026-03-02",
  },
];

const INITIAL_USERS: ServerUser[] = [
  {
    id: "demo-admin",
    email: "admin@demo.com",
    password: "demo123",
    name: "HypeEngine Admin",
    role: "admin",
    credits: 0,
    setupComplete: true,
  },
  {
    id: "demo-client",
    email: "client@demo.com",
    password: "demo",
    name: "Alex Johnson",
    role: "client",
    companyName: "CryptoVentures Inc.",
    title: "Marketing Lead",
    twitterAccount: "@cryptoventures",
    website: "cryptoventures.io",
    credits: 900,
    setupComplete: true,
    walletConnected: true,
  },
  {
    id: "demo-kol",
    email: "kol@demo.com",
    password: "demo",
    name: "Sarah Chen",
    role: "kol",
    twitterAccount: "@sarahcrypto",
    followers: 52000,
    kolValue: 85,
    credits: 2570,
    setupComplete: true,
    agreedToTerms: true,
    bio: "Crypto & Web3 content creator. NFT collector. Building in public. Views my own.",
    country: "United States",
    language: "English",
    niches: ["Web3", "Crypto", "NFT"],
    twitterFollowers: 52000,
    twitterFollowing: 630,
  },
  {
    id: "kol-marcus",
    email: "kol2@demo.com",
    password: "demo",
    name: "Marcus Tan",
    role: "kol",
    twitterAccount: "@marcusplays",
    followers: 89000,
    kolValue: 78,
    credits: 1240,
    setupComplete: true,
    agreedToTerms: true,
    bio: "Web3 gamer & GameFi enthusiast. Play-to-earn since 2021. Philippines 🇵🇭",
    country: "Philippines",
    language: "English",
    niches: ["Gaming", "GameFi", "Lifestyle"],
    twitterFollowers: 89000,
    twitterFollowing: 1420,
  },
  {
    id: "kol-elena",
    email: "kol3@demo.com",
    password: "demo",
    name: "Elena Müller",
    role: "kol",
    twitterAccount: "@elenamueller_fi",
    followers: 34000,
    kolValue: 91,
    credits: 880,
    setupComplete: true,
    agreedToTerms: true,
    bio: "DeFi researcher & quant finance nerd. Covering protocols, yields, and on-chain data. 🇩🇪",
    country: "Germany",
    language: "German",
    niches: ["DeFi", "Finance", "AI / Tech"],
    twitterFollowers: 34000,
    twitterFollowing: 290,
  },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: "tx-1", userId: "demo-client", type: "deposit", amount: 10000, description: "Initial credit purchase", createdAt: "2026-02-28T10:00:00Z" },
  { id: "tx-2", userId: "demo-client", type: "spend", amount: -3750, description: "MetaVerse Launch Campaign", createdAt: "2026-03-01T10:00:00Z" },
  { id: "tx-3", userId: "demo-client", type: "spend", amount: -1350, description: "DeFi Protocol Awareness", createdAt: "2026-03-05T10:00:00Z" },
  { id: "tx-4", userId: "demo-client", type: "spend", amount: -4000, description: "Blockchain Summit 2026", createdAt: "2026-02-15T10:00:00Z" },
  { id: "ktx-1", userId: "demo-kol", type: "earn", amount: 75, description: "NFT Collection Drop post", createdAt: "2026-03-09T10:00:00Z" },
  { id: "ktx-2", userId: "demo-kol", type: "earn", amount: 50, description: "MetaVerse Launch Campaign post", createdAt: "2026-03-02T10:00:00Z" },
  { id: "ktx-3", userId: "demo-kol", type: "earn", amount: 45, description: "Blockchain Summit 2026 post", createdAt: "2026-02-16T10:00:00Z" },
  { id: "ktx-4", userId: "demo-kol", type: "withdraw", amount: -100, description: "Withdrawal to Binance", createdAt: "2026-02-20T10:00:00Z" },
];

declare global {
  var _heStore: Store | undefined;
  var _heStoreVersion: number | undefined;
}

const STORE_VERSION = 5;

function initStore(): Store {
  return {
    users: INITIAL_USERS.map((u) => ({ ...u })),
    campaigns: INITIAL_CAMPAIGNS.map((c) => ({ ...c })),
    posts: INITIAL_POSTS.map((p) => ({ ...p })),
    transactions: INITIAL_TRANSACTIONS.map((t) => ({ ...t })),
  };
}

if (!global._heStore || global._heStoreVersion !== STORE_VERSION) {
  global._heStore = initStore();
  global._heStoreVersion = STORE_VERSION;
}

export const store = global._heStore!;

export function stripPassword(user: ServerUser): Omit<ServerUser, "password"> {
  const { password: _, ...rest } = user;
  return rest;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
