export type DashboardQuote = {
  text: string;
  author: string;
  work: string | null;
  categories: string[];
  source: "api-ninjas";
};

export type DashboardQuoteResponse = {
  configured: boolean;
  quote: DashboardQuote | null;
};
