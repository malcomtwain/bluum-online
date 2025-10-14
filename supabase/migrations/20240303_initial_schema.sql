-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (linked to Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create templates table (Part 1)
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  scale DECIMAL NOT NULL DEFAULT 1.0,
  duration DECIMAL NOT NULL DEFAULT 3.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create media table (Part 2)
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  duration DECIMAL NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create music table
CREATE TABLE music (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create hooks table
CREATE TABLE hooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create generated_images table
CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  hook_id UUID REFERENCES hooks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  font_type TEXT NOT NULL CHECK (font_type IN ('withBackground', 'withBackgroundBlack', 'normal')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create generated_videos table
CREATE TABLE generated_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  generated_image_id UUID REFERENCES generated_images(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  music_id UUID REFERENCES music(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE music ENABLE ROW LEVEL SECURITY;
ALTER TABLE hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_videos ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can only access their own data" ON users
  FOR ALL USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can only access their own projects" ON projects
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = user_id));

CREATE POLICY "Users can only access their own templates" ON templates
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)));

CREATE POLICY "Users can only access their own media" ON media
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)));

CREATE POLICY "Users can only access their own music" ON music
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)));

CREATE POLICY "Users can only access their own hooks" ON hooks
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)));

CREATE POLICY "Users can only access their own generated images" ON generated_images
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id)));

CREATE POLICY "Users can only access their own generated videos" ON generated_videos
  FOR ALL USING (auth.uid()::text IN (SELECT clerk_id FROM users WHERE id = (SELECT user_id FROM projects WHERE id = project_id))); 