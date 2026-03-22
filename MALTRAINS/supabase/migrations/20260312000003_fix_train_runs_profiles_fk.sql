-- Migration to add foreign key between train_runs and user_profiles
-- This allows the Dashboard to fetch operator names via a single join

ALTER TABLE "public"."train_runs" 
ADD CONSTRAINT "train_runs_user_profiles_fkey" 
FOREIGN KEY ("user_id") 
REFERENCES "public"."user_profiles"("user_id") 
ON DELETE CASCADE;
