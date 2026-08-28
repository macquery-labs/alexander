CREATE TABLE IF NOT EXISTS "ModelSettings" (
  "userId" uuid PRIMARY KEY NOT NULL REFERENCES "User"("id"),
  "chat" varchar(128),
  "title" varchar(128),
  "artifactText" varchar(128),
  "artifactCode" varchar(128),
  "artifactSheet" varchar(128),
  "suggestions" varchar(128),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
