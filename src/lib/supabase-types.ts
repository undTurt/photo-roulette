export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string
          room_code: string
          status: string
          current_round: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_code: string
          status?: string
          current_round?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_code?: string
          status?: string
          current_round?: number
          created_at?: string
          updated_at?: string
        }
      }
      players: {
        Row: {
          id: string
          game_id: string
          name: string
          score: number
          ready: boolean
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          name: string
          score?: number
          ready?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          name?: string
          score?: number
          ready?: boolean
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          game_id: string
          player_id: string
          storage_path: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          storage_path: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          storage_path?: string
          used?: boolean
          created_at?: string
        }
      }
    }
  }
}