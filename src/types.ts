export type StudySession = {
  id: string;
  user_id: string;
  location: string;
  subject: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
};

export type CheckIn = {
  id: string;
  user_id: string;
  location: string;
  checked_in_at: string;
};
