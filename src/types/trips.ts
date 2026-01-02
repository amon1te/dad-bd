export interface TripData {
  countryName: string;
  iso2: string;
  continent: string;
  year: string;
  cities: string[];
  notes: string;
  photos: string[];
  // legacy / optional flags (kept for backwards compatibility with existing JSON)
  isHome?: boolean;
}
  
  export interface ProfileData {
    title: string;
    subtitle: string;
  }
  
  export interface TripsJson {
  profile: ProfileData;
  homeCountry?: string;
  visited: TripData[];
}
  