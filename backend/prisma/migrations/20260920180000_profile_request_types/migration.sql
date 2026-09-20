DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ProfileChangeRequestType' AND e.enumlabel = 'CONTACT_NUMBER'
  ) THEN
    ALTER TYPE "ProfileChangeRequestType" ADD VALUE 'CONTACT_NUMBER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ProfileChangeRequestType' AND e.enumlabel = 'ADDRESS'
  ) THEN
    ALTER TYPE "ProfileChangeRequestType" ADD VALUE 'ADDRESS';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ProfileChangeRequestType' AND e.enumlabel = 'EMAIL'
  ) THEN
    ALTER TYPE "ProfileChangeRequestType" ADD VALUE 'EMAIL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ProfileChangeRequestType' AND e.enumlabel = 'NAME'
  ) THEN
    ALTER TYPE "ProfileChangeRequestType" ADD VALUE 'NAME';
  END IF;
END $$;
