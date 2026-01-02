# Dad's 50th Birthday - Travel Memories Map 🎉

An interactive world map celebrating Dad's 50th birthday, featuring all the countries he has visited with photos and memories from each adventure.

## Features

- **Interactive World Map**: Click or tap on visited countries to see memories
- **Memory Cards**: Photo galleries with notes, cities visited, and dates
- **Travel Stats**: Countries visited, cities explored, favorite continent
- **Search & Filter**: Find countries quickly by name or continent
- **Birthday Confetti**: Celebratory confetti burst on page load
- **Responsive Design**: Works great on desktop, tablet, and mobile
- **Offline-Ready**: Static build that can work offline once loaded

## How to Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## How to Add a New Country Memory

1. Open `public/data/trips.json`
2. Add a new entry to the `visited` array:

```json
{
  "countryName": "Spain",
  "iso2": "ES",
  "continent": "Europe",
  "year": "2024",
  "cities": ["Barcelona", "Madrid"],
  "notes": "Write your memory here...",
  "photos": [
    "/assets/photos/spain_1.jpg",
    "/assets/photos/spain_2.jpg"
  ]
}
```

3. Add your photos to `public/assets/photos/`
4. The map will automatically highlight the new country

## Country ISO2 Codes

Use standard ISO 3166-1 alpha-2 country codes. Examples:
- US - United States
- FR - France
- JP - Japan
- AU - Australia
- BR - Brazil
- IT - Italy
- DE - Germany
- ES - Spain
- GB - United Kingdom
- CN - China

Find all codes at: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2

## Data Schema

```json
{
  "profile": {
    "title": "Happy 50th Birthday, Dad!",
    "subtitle": "A map of the places you've explored..."
  },
  "visited": [
    {
      "countryName": "Country Name",
      "iso2": "XX",
      "continent": "Europe|Asia|Africa|North America|South America|Oceania",
      "year": "2024",
      "cities": ["City 1", "City 2"],
      "notes": "Memories and stories...",
      "photos": ["/assets/photos/photo.jpg"]
    }
  ]
}
```

## Customization

### Change Title & Subtitle
Edit `profile.title` and `profile.subtitle` in `public/data/trips.json`

### Change Colors
Edit CSS variables in `src/index.css`:
- `--primary`: Main gold color
- `--accent`: Burgundy accent color
- `--map-visited`: Visited country color
- `--map-bg`: Map background color

## Deploy as Static Site

### Netlify
1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`

### Vercel
1. Import your GitHub repository
2. Framework preset: Vite
3. Deploy automatically

### GitHub Pages
1. Build: `npm run build`
2. Push `dist` folder to `gh-pages` branch
3. Enable Pages in repository settings

## Tech Stack

- Vite
- TypeScript
- React
- Tailwind CSS
- Framer Motion (animations)
- react-simple-maps (world map)
- canvas-confetti (birthday confetti)

## License

Made with ❤️ for Dad's 50th Birthday
