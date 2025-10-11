# Data Model

The data model for this feature relies on the existing `media` and `media_sources` tables as defined in the project's `GEMINI.md`.

### `media` Table

```sql
CREATE TABLE media (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES media_sources(id) ON DELETE CASCADE, -- Which media source it belongs to
  file_path TEXT NOT NULL,           -- Relative path within the source
  file_name TEXT NOT NULL,           -- File name
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')), -- Media type
  width INTEGER NOT NULL,            -- Media width
  height INTEGER NOT NULL,           -- Media height
  file_size BIGINT,                  -- File size in bytes
  
  -- Additional information at upload time
  description TEXT,                  -- Media description (user input)
  source_url TEXT,                   -- Source link (user input)
  
  -- File information
  created_at TIMESTAMP NOT NULL,     -- File creation timestamp
  modified_at TIMESTAMP NOT NULL,    -- File modification timestamp
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),     -- DB registration timestamp
  
  UNIQUE(source_id, file_path)
);
```

### `media_sources` Table

```sql
CREATE TABLE media_sources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,                 -- Display name of the media source
  description TEXT,                   -- Description of the media source
  type TEXT NOT NULL CHECK (type IN ('local', 'sftp', 's3')), -- Type of media source
  connection_info JSONB NOT NULL,     -- Connection information (JSON)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Creation timestamp
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()  -- Update timestamp
);
```
