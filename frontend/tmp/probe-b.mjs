// src/quote/sample_history.json
var sample_history_default = {
  notice: "SAMPLE history for the preview: made-up customers and messages, priced from the sample rates. Not real PAPH data.",
  count: 64,
  days: 180,
  seed: 2026,
  customers: [
    "Sample: Andrea V.",
    "Sample: Bong and Lyn",
    "Sample: Cruz barkada",
    "Sample: Dianne P.",
    "Sample: Enzo M.",
    "Sample: Fe and Tony",
    "Sample: Gabby L.",
    "Sample: Hazel R.",
    "Sample: Ivan S.",
    "Sample: Joanna and Mark",
    "Sample: Kat D.",
    "Sample: Lim family",
    "Sample: Marco T.",
    "Sample: Nina A.",
    "Sample: Ocampo family",
    "Sample: Patty G.",
    "Sample: Quino couple",
    "Sample: Rhea B.",
    "Sample: Santos family",
    "Sample: Tricia N.",
    "Sample: Uy siblings",
    "Sample: Vince C.",
    "Sample: Wena and Jojo",
    "Sample: Yap family"
  ],
  requests: [
    "gusto ko pumunta London 10 days, 4 star hotel, history and museums",
    "London 7 days solo, budget friendly, mga 150k",
    "Japan 6 days, 2 adults 2 kids, Disneyland and Universal, April",
    "Tokyo and Osaka 5 days kami ng asawa ko, food trip and shopping",
    "Japan 8 days autumn November, 4 star, 2 adults",
    "Seoul 5 days barkada 4 pax, budget lang, shopping and Nami island",
    "Korea 6 days 2 adults, sa April para sa cherry blossoms",
    "Singapore 4 days family of 4, Universal Studios",
    "Hong Kong 3 days 2 adults 1 kid, Disneyland",
    "Bangkok 5 days 3 pax food trip and shopping, mura lang",
    "Dubai 6 days 2 adults 5 star, desert safari",
    "Bali honeymoon 6 days luxury villa",
    "Taipei 4 days 2 adults, night markets and Jiufen",
    "Boracay 4 days barkada 6 tao, beach and island hopping",
    "El Nido 5 days kami ng asawa ko, island hopping",
    "Paris 8 days 2 adults, Eiffel and Disneyland, 4 star",
    "Japan 5 days 2 adults, budget 120k total",
    "Singapore 5 days 2 adults 2 kids, May, mid range",
    "Boracay 5 days family of 5, December",
    "Seoul 5 days 2 adults, 60k each"
  ],
  questions: [
    "Kasama na po ba ang breakfast?",
    "Pwede po bang installment ang bayad?",
    "Ilang araw po bago lumabas ang visa?",
    "Ang tagal po ng reply, may update na po ba sa offer?",
    "Pwede po bang ilipat sa mas malapit na hotel sa train station?",
    "Is airport pickup included?"
  ],
  changes: [
    "Medyo mahal po, pwede po bang mas mura na hotel?",
    "Pwede po bang tanggalin ang isang tour para bumaba ang presyo?",
    "Can we move the trip one week later?",
    "Please add one more night in Osaka.",
    "Sobrang mahal ng flights, may promo fare po ba?"
  ],
  feedback: [
    [5, "Sobrang ganda ng hotel at ang bait ng tour guide! Babalik kami next year."],
    [5, "Super smooth ng trip, salamat PAPH! Highly recommend."],
    [5, "Everything was well organized and the hotel was perfect. Thank you!"],
    [4, "Maganda ang itinerary, medyo pagod lang sa dami ng lakad pero sulit."],
    [4, "Good hotel and friendly staff. Visa process was easy."],
    [4, "Sulit ang package, ang sarap ng food trip!"],
    [3, "Okay naman ang trip pero late ang sundo sa airport."],
    [3, "Ayos ang hotel pero sobrang tagal ng reply ng agent bago ang trip."],
    [2, "Late ang airport transfer ng isang oras at walang update."],
    [2, "Ang tagal mag-reply sa Messenger, muntik na kaming hindi makaalis."],
    [1, "Disappointed, maliit at madumi ang hotel room kumpara sa picture."]
  ],
  lost_notes: {
    price: ["Found a cheaper package online.", "Sabi nila mas mura sa ibang agency."],
    dates: ["Hindi pinayagan ang leave sa trabaho.", "Fully booked ang flights sa dates nila."],
    other_agency: ["Nag-book sa kakilala nilang agent."],
    no_response: ["No reply after we sent the quotation."],
    plans_changed: ["Trip cancelled because of a family emergency."]
  }
};

// src/quote/catalog.json
var catalog_default = {
  notice: "Sample rates for this preview: prices are rough estimates in Philippine pesos, not PAPH Travel and Tours' final prices. Visa and document notes are general guides for Philippine passport holders; always check the latest requirements.",
  version: "sample-2026-11",
  rules: {
    service_fee_pct: 10,
    service_fee_min: 1500,
    min_margin_pct: 8,
    validity_days: 7,
    deposit_pct: 30,
    balance_days_before: 30,
    kid_flight_factor: 0.75,
    kid_tour_factor: 0.5,
    kid_local_factor: 0.5,
    group_size: 6,
    group_discount_pct: 5,
    peak_surcharge_pct: 15,
    offpeak_saving_pct: 8,
    premium_transfer_factor: 1.6,
    insurance_per_day: { international: [180, 260], domestic: [70, 110] },
    default_days: 5,
    min_days: 2,
    max_days: 30,
    waiting_hours: 24,
    ph_peak: { "12": "Christmas and New Year", "1": "New Year holidays", "4": "Holy Week and summer break", "5": "summer school break" }
  },
  tiers: {
    budget: { label: "Budget", hotel: "3-star or good budget hotel" },
    mid: { label: "Mid-range", hotel: "4-star hotel" },
    luxury: { label: "5-star", hotel: "5-star hotel" }
  },
  options: [
    { code: "budget", label: "Budget", tier: "budget", tour_share: 0.34, blurb: "Good, clean stay and the must-sees, at the lowest price." },
    { code: "value", label: "Best value", tier: "mid", tour_share: 0.5, blurb: "Comfortable 4-star stay in a central area with a balanced set of tours." },
    { code: "premium", label: "Premium", tier: "luxury", tour_share: 0.75, blurb: "5-star stay in the best area, more guided tours and private transfers." }
  ],
  interests: {
    shopping: ["shopping", "shop", "mall", "outlet", "pasalubong", "mamili"],
    food: ["food", "foodie", "eat", "kain", "kainan", "street food", "restaurant", "cafe"],
    history: ["history", "historical", "museum", "museo", "castle", "palace", "heritage", "culture", "temple", "templo"],
    theme_parks: ["disney", "disneyland", "universal", "theme park", "amusement", "lotte world", "everland", "ocean park"],
    nature: ["nature", "mountain", "bundok", "hike", "hiking", "trek", "lake", "waterfall", "countryside", "fuji"],
    beach: ["beach", "dagat", "island", "isla", "snorkel", "snorkeling", "dive", "diving", "swim"],
    family: ["kids", "kid", "child", "children", "bata", "anak", "family", "pamilya"],
    romance: ["honeymoon", "anniversary", "romantic", "couple", "proposal", "mag-asawa"],
    nightlife: ["nightlife", "party", "bar", "night market", "inuman"],
    shows: ["show", "musical", "theatre", "theater", "concert", "west end"],
    football: ["football", "soccer", "premier league", "stadium"],
    snow: ["snow", "niyebe", "winter", "ski"]
  },
  addons: [
    { code: "insurance", label: "Travel insurance", unit: "per person per day", detail: "Medical, trip delay and baggage cover (sample plan)." },
    { code: "private_transfer", label: "Private airport transfers", unit: "per booking", cost: [2800, 2800], price: 3500, detail: "Private car with driver instead of a shared shuttle, both ways." },
    { code: "wifi", label: "Pocket WiFi or travel SIM", unit: "per day", cost: [250, 250], price: 350, detail: "One device or SIM for the whole trip." }
  ],
  destinations: [
    {
      code: "london",
      name: "London",
      country: "United Kingdom",
      region: "Europe",
      domestic: false,
      aliases: ["london", "england", "united kingdom", "uk", "britain"],
      flight: [48e3, 68e3],
      flight_note: "Round-trip economy from Manila with one stop",
      peak_months: [6, 7, 8, 12],
      low_months: [1, 2, 3, 11],
      min_days: 5,
      best_days: [7, 10],
      hotels: {
        budget: { rate: [6e3, 8500], area: "King's Cross or Paddington", why: "Cheaper rooms with direct trains to the airport and the sights.", stay: "Sample 3-star hotel near a Tube station" },
        mid: { rate: [1e4, 15e3], area: "South Kensington", why: "Quiet, safe and walking distance to the big museums and Hyde Park.", stay: "Sample 4-star hotel in South Kensington" },
        luxury: { rate: [24e3, 38e3], area: "Mayfair or Westminster", why: "Walk to Buckingham Palace, Big Ben and the best shopping streets.", stay: "Sample 5-star hotel in Mayfair" }
      },
      transfer: [5500, 7500],
      transfer_per_person: false,
      local: [900, 1300],
      local_note: "Oyster or contactless train and bus fares",
      insurance_required: false,
      visa: { needed: true, fee: [10500, 13500], label: "UK Standard Visitor visa", note: "Apply online, then give fingerprints at the visa centre. Allow about 3 to 4 weeks.", docs: ["Passport valid for the whole stay, with a blank page", "Completed online visa application and appointment", "Bank statements for the last 6 months", "Certificate of employment or business papers", "Income tax return (ITR)", "Hotel bookings and round-trip flight plan", "Travel insurance (recommended)"] },
      tours: [
        { name: "London Eye and Thames river cruise", price: [3200, 4200], tags: ["romance", "family"] },
        { name: "Tower of London and Crown Jewels", price: [2500, 3200], tags: ["history", "family"] },
        { name: "Stonehenge and Bath day trip", price: [7500, 9500], tags: ["history", "nature"] },
        { name: "Harry Potter studio tour", price: [6500, 8e3], tags: ["family", "theme_parks", "shows"] },
        { name: "West End musical (good seats)", price: [4500, 9e3], tags: ["shows", "romance", "nightlife"] },
        { name: "Windsor Castle half-day tour", price: [4200, 5500], tags: ["history"] },
        { name: "Oxford and Cotswolds day trip", price: [6500, 8500], tags: ["nature", "history"] },
        { name: "Football stadium tour", price: [2200, 3e3], tags: ["football"] },
        { name: "Afternoon tea experience", price: [3200, 5e3], tags: ["food", "romance"] }
      ],
      ideas: [
        { text: "Westminster walk: Big Ben, Westminster Abbey and Buckingham Palace changing of the guard", tags: ["history"] },
        { text: "British Museum and Covent Garden (museum is free)", tags: ["history", "shows"] },
        { text: "Oxford Street, Regent Street and Harrods shopping", tags: ["shopping"] },
        { text: "Borough Market food crawl and the South Bank", tags: ["food"] },
        { text: "Hyde Park, Kensington Palace and the Natural History Museum", tags: ["nature", "family"] },
        { text: "Camden Market and Notting Hill", tags: ["shopping", "food"] }
      ],
      alternatives: ["paris", "dubai", "seoul", "japan"]
    },
    {
      code: "paris",
      name: "Paris",
      country: "France",
      region: "Europe",
      domestic: false,
      aliases: ["paris", "france", "eiffel"],
      flight: [5e4, 7e4],
      flight_note: "Round-trip economy from Manila with one stop",
      peak_months: [5, 6, 7, 8, 12],
      low_months: [1, 2, 3, 11],
      min_days: 5,
      best_days: [6, 9],
      hotels: {
        budget: { rate: [6500, 9e3], area: "Montmartre", why: "Charming hilltop area with cheaper rooms and easy Metro rides.", stay: "Sample 3-star hotel in Montmartre" },
        mid: { rate: [11e3, 16e3], area: "Saint-Germain or Le Marais", why: "Central, walkable, full of cafes and close to the Louvre.", stay: "Sample 4-star hotel in Le Marais" },
        luxury: { rate: [26e3, 42e3], area: "near the Champs-Elysees", why: "Grand hotels with Eiffel Tower views and luxury shopping outside.", stay: "Sample 5-star hotel near the Champs-Elysees" }
      },
      transfer: [5e3, 7e3],
      transfer_per_person: false,
      local: [700, 1e3],
      local_note: "Metro and RER train fares",
      insurance_required: true,
      visa: { needed: true, fee: [7500, 9500], label: "Schengen visa (France)", note: "Book a visa centre appointment early. Travel insurance of at least EUR 30,000 is required.", docs: ["Passport valid 3 months after you leave, issued within 10 years", "Schengen visa form and 2 photos", "Bank statements for the last 6 months", "Certificate of employment with leave approval", "Income tax return (ITR)", "Flight reservation and hotel bookings", "Schengen travel insurance (included in this package)"] },
      tours: [
        { name: "Eiffel Tower summit with host", price: [3600, 4500], tags: ["romance", "family"] },
        { name: "Louvre Museum guided visit", price: [3500, 4800], tags: ["history"] },
        { name: "Seine dinner cruise", price: [5500, 8500], tags: ["romance", "food"] },
        { name: "Palace of Versailles day tour", price: [5500, 7500], tags: ["history"] },
        { name: "Disneyland Paris one day", price: [5500, 7500], tags: ["theme_parks", "family"] },
        { name: "Mont Saint-Michel day trip", price: [9e3, 12e3], tags: ["history", "nature"] },
        { name: "Montmartre walking and food tour", price: [2200, 3e3], tags: ["food", "history"] }
      ],
      ideas: [
        { text: "Champs-Elysees and the Arc de Triomphe", tags: ["shopping"] },
        { text: "Notre-Dame area, Ile de la Cite and Latin Quarter cafes", tags: ["history", "food"] },
        { text: "Galeries Lafayette and the Opera district", tags: ["shopping"] },
        { text: "Luxembourg Gardens and Saint-Germain bakeries", tags: ["nature", "food", "romance"] },
        { text: "Trocadero sunset photos of the Eiffel Tower", tags: ["romance"] }
      ],
      alternatives: ["london", "dubai", "seoul", "japan"]
    },
    {
      code: "japan",
      name: "Japan (Tokyo and Osaka)",
      country: "Japan",
      region: "East Asia",
      domestic: false,
      aliases: ["japan", "tokyo", "osaka", "kyoto", "japan tour", "hapon"],
      flight: [18e3, 32e3],
      flight_note: "Manila to Tokyo, Osaka to Manila (open-jaw), economy",
      peak_months: [3, 4, 10, 11, 12],
      low_months: [1, 2, 6],
      min_days: 4,
      best_days: [5, 8],
      hotels: {
        budget: { rate: [3800, 5500], area: "Shinjuku (Tokyo) and Namba (Osaka)", why: "Small but clean rooms next to the main train lines and food streets.", stay: "Sample business hotel" },
        mid: { rate: [7e3, 10500], area: "Shibuya (Tokyo) and Umeda (Osaka)", why: "Bigger rooms, right on top of the shopping and the stations.", stay: "Sample 4-star city hotel" },
        luxury: { rate: [2e4, 32e3], area: "Ginza (Tokyo) and Umeda (Osaka)", why: "Luxury rooms with skyline views, steps from high-end shopping.", stay: "Sample 5-star hotel in Ginza" }
      },
      transfer: [6e3, 9e3],
      transfer_per_person: false,
      local: [1200, 1800],
      local_note: "City trains, subway and IC card top-ups",
      insurance_required: false,
      visa: { needed: true, fee: [1200, 2e3], label: "Japan tourist visa (through an accredited agency)", note: "Filed through an accredited agency. Allow about 2 weeks.", docs: ["Passport valid for the whole stay", "Visa application form and 1 photo (4.5 x 3.5 cm)", "PSA birth certificate (and marriage certificate if married)", "Bank certificate and statements", "Certificate of employment or business papers", "Income tax return (ITR)", "Daily itinerary"] },
      tours: [
        { name: "Mt. Fuji and Hakone day tour", price: [4500, 6500], tags: ["nature", "snow"] },
        { name: "Tokyo Disneyland or DisneySea", price: [4200, 5200], tags: ["theme_parks", "family"] },
        { name: "Universal Studios Japan", price: [4500, 5800], tags: ["theme_parks", "family"] },
        { name: "Kyoto and Nara day tour", price: [4e3, 5800], tags: ["history", "nature"] },
        { name: "Bullet train Tokyo to Osaka", price: [7500, 8500], tags: ["family"] },
        { name: "teamLab digital art museum", price: [1800, 2200], tags: ["family", "romance"] },
        { name: "Kimono and tea ceremony", price: [3e3, 4500], tags: ["history", "romance"] }
      ],
      ideas: [
        { text: "Asakusa Senso-ji temple and Nakamise street snacks", tags: ["history", "food"] },
        { text: "Shibuya Crossing, Harajuku and Omotesando shopping", tags: ["shopping"] },
        { text: "Akihabara and Ginza", tags: ["shopping"] },
        { text: "Dotonbori food trip and Osaka Castle", tags: ["food", "history"] },
        { text: "Shinjuku Gyoen garden and Omoide Yokocho alley", tags: ["nature", "food"] }
      ],
      alternatives: ["seoul", "taiwan", "hongkong"]
    },
    {
      code: "seoul",
      name: "Seoul",
      country: "South Korea",
      region: "East Asia",
      domestic: false,
      aliases: ["seoul", "korea", "south korea", "busan"],
      flight: [14e3, 26e3],
      flight_note: "Round-trip economy, direct",
      peak_months: [4, 10, 12],
      low_months: [1, 2, 7],
      min_days: 4,
      best_days: [5, 7],
      hotels: {
        budget: { rate: [3200, 4800], area: "Myeongdong", why: "Budget hotels in the middle of the shopping and street food.", stay: "Sample 3-star hotel in Myeongdong" },
        mid: { rate: [6e3, 9e3], area: "Hongdae or Insadong", why: "Lively, youthful area with cafes and easy subway access.", stay: "Sample 4-star hotel in Hongdae" },
        luxury: { rate: [16e3, 26e3], area: "Gangnam or Jung-gu", why: "Luxury towers near the palaces and the upscale side of Seoul.", stay: "Sample 5-star hotel in Gangnam" }
      },
      transfer: [4e3, 6e3],
      transfer_per_person: false,
      local: [600, 900],
      local_note: "Subway and T-money card",
      insurance_required: false,
      visa: { needed: true, fee: [1800, 2800], label: "Korea tourist visa (through an accredited agency)", note: "Usually about 2 weeks through an accredited agency.", docs: ["Passport valid 6 months beyond your trip", "Visa form and 1 photo", "Bank certificate and statements", "Certificate of employment", "Income tax return (ITR)", "Flight plan and hotel booking"] },
      tours: [
        { name: "Nami Island and Petite France day tour", price: [3200, 4200], tags: ["nature", "romance"] },
        { name: "DMZ border tour", price: [3500, 4800], tags: ["history"] },
        { name: "Lotte World theme park", price: [2800, 3500], tags: ["theme_parks", "family"] },
        { name: "Everland theme park", price: [3e3, 3800], tags: ["theme_parks", "family"] },
        { name: "Hanbok rental and Gyeongbokgung Palace", price: [1500, 2500], tags: ["history", "romance"] },
        { name: "Seoraksan mountain day trip", price: [3800, 5e3], tags: ["nature", "snow"] },
        { name: "N Seoul Tower", price: [900, 1300], tags: ["romance", "family"] }
      ],
      ideas: [
        { text: "Myeongdong shopping and street food", tags: ["shopping", "food"] },
        { text: "Bukchon Hanok Village and Insadong", tags: ["history"] },
        { text: "Hongdae cafes and night street performers", tags: ["nightlife", "food"] },
        { text: "Cheonggyecheon stream and Gwangjang Market", tags: ["food"] },
        { text: "Dongdaemun night shopping", tags: ["shopping", "nightlife"] }
      ],
      alternatives: ["japan", "taiwan", "hongkong"]
    },
    {
      code: "singapore",
      name: "Singapore",
      country: "Singapore",
      region: "Southeast Asia",
      domestic: false,
      aliases: ["singapore", "sg", "sentosa"],
      flight: [7e3, 14e3],
      flight_note: "Round-trip economy, direct",
      peak_months: [6, 12],
      low_months: [2, 9],
      min_days: 3,
      best_days: [4, 5],
      hotels: {
        budget: { rate: [5500, 7500], area: "Bugis or Little India", why: "Lower rates with the MRT at the door and cheap hawker food.", stay: "Sample 3-star hotel in Bugis" },
        mid: { rate: [9e3, 13e3], area: "Orchard Road", why: "Shopping street right outside, central to everything.", stay: "Sample 4-star hotel on Orchard" },
        luxury: { rate: [2e4, 32e3], area: "Marina Bay", why: "Skyline views, Gardens by the Bay and the river at your doorstep.", stay: "Sample 5-star hotel at Marina Bay" }
      },
      transfer: [2500, 3500],
      transfer_per_person: false,
      local: [500, 800],
      local_note: "MRT and bus fares",
      insurance_required: false,
      visa: { needed: false, fee: [0, 0], label: "No visa needed for short visits", note: "Philippine passport holders can usually visit visa-free for up to 30 days.", docs: ["Passport valid at least 6 months", "SG Arrival Card filled online within 3 days before arrival", "Return ticket and hotel booking", "Proof of funds"] },
      tours: [
        { name: "Universal Studios Singapore", price: [3600, 4200], tags: ["theme_parks", "family"] },
        { name: "Gardens by the Bay flower domes", price: [1800, 2300], tags: ["nature", "romance"] },
        { name: "Night Safari", price: [2800, 3300], tags: ["family", "nature"] },
        { name: "Sentosa cable car and beaches", price: [1500, 2e3], tags: ["beach", "family"] },
        { name: "S.E.A. Aquarium", price: [1800, 2200], tags: ["family"] },
        { name: "Singapore River cruise", price: [1100, 1500], tags: ["romance"] }
      ],
      ideas: [
        { text: "Merlion Park and the Marina Bay light show", tags: ["romance"] },
        { text: "Chinatown and Maxwell hawker centre", tags: ["food"] },
        { text: "Orchard Road shopping", tags: ["shopping"] },
        { text: "Kampong Glam and Haji Lane", tags: ["history", "shopping"] }
      ],
      alternatives: ["hongkong", "bangkok", "bali"]
    },
    {
      code: "hongkong",
      name: "Hong Kong",
      country: "Hong Kong",
      region: "East Asia",
      domestic: false,
      aliases: ["hong kong", "hongkong", "hk", "macau", "macao"],
      flight: [6e3, 12e3],
      flight_note: "Round-trip economy, direct",
      peak_months: [12, 4],
      low_months: [6, 9],
      min_days: 3,
      best_days: [4, 5],
      hotels: {
        budget: { rate: [4500, 6500], area: "Tsim Sha Tsui", why: "Cheaper rooms near the harbour, the MTR and Nathan Road shopping.", stay: "Sample 3-star hotel in Tsim Sha Tsui" },
        mid: { rate: [7500, 11e3], area: "Causeway Bay", why: "Shopping and dim sum all around, quick MTR to everything.", stay: "Sample 4-star hotel in Causeway Bay" },
        luxury: { rate: [18e3, 3e4], area: "Central or Victoria Harbour", why: "Harbour-view rooms and the city's finest dining nearby.", stay: "Sample 5-star harbour-view hotel" }
      },
      transfer: [2500, 3800],
      transfer_per_person: false,
      local: [500, 800],
      local_note: "MTR and Octopus card",
      insurance_required: false,
      visa: { needed: false, fee: [0, 0], label: "No visa needed for short visits", note: "Philippine passport holders can usually visit visa-free for up to 14 days.", docs: ["Passport valid at least 6 months", "Return ticket and hotel booking", "Proof of funds"] },
      tours: [
        { name: "Hong Kong Disneyland", price: [4e3, 4800], tags: ["theme_parks", "family"] },
        { name: "Ocean Park", price: [3500, 4200], tags: ["theme_parks", "family"] },
        { name: "Peak Tram and Sky Terrace", price: [1300, 1700], tags: ["romance", "family"] },
        { name: "Ngong Ping cable car and Big Buddha", price: [1800, 2600], tags: ["history", "nature"] },
        { name: "Macau day trip", price: [3800, 5200], tags: ["history", "food"] },
        { name: "Harbour night cruise", price: [1500, 2200], tags: ["romance", "nightlife"] }
      ],
      ideas: [
        { text: "Mong Kok Ladies Market and Temple Street night market", tags: ["shopping", "nightlife"] },
        { text: "Dim sum breakfast and Central street escalators", tags: ["food"] },
        { text: "Avenue of Stars and the harbour light show", tags: ["romance"] },
        { text: "Stanley Market and the south side beaches", tags: ["beach", "shopping"] }
      ],
      alternatives: ["singapore", "taiwan", "bangkok"]
    },
    {
      code: "bangkok",
      name: "Bangkok",
      country: "Thailand",
      region: "Southeast Asia",
      domestic: false,
      aliases: ["bangkok", "thailand", "bkk", "pattaya"],
      flight: [7e3, 14e3],
      flight_note: "Round-trip economy, direct",
      peak_months: [12, 1, 4],
      low_months: [6, 9],
      min_days: 3,
      best_days: [4, 6],
      hotels: {
        budget: { rate: [2200, 3500], area: "Sukhumvit (Nana)", why: "Good-value rooms near the Skytrain and night markets.", stay: "Sample 3-star hotel on Sukhumvit" },
        mid: { rate: [4500, 7e3], area: "Siam or Silom", why: "Next to the big malls and the Skytrain, easy for families.", stay: "Sample 4-star hotel in Siam" },
        luxury: { rate: [12e3, 22e3], area: "Chao Phraya riverside", why: "Riverside luxury with boat rides to the temples.", stay: "Sample 5-star riverside hotel" }
      },
      transfer: [1800, 2800],
      transfer_per_person: false,
      local: [400, 700],
      local_note: "Skytrain, boats and taxis",
      insurance_required: false,
      visa: { needed: false, fee: [0, 0], label: "No visa needed for short visits", note: "Philippine passport holders can usually visit visa-free. Check the latest rules and any arrival card.", docs: ["Passport valid at least 6 months", "Return ticket and hotel booking", "Proof of funds"] },
      tours: [
        { name: "Grand Palace and temples tour", price: [1800, 2600], tags: ["history"] },
        { name: "Floating market and railway market", price: [2200, 3e3], tags: ["food", "history"] },
        { name: "Ayutthaya day trip", price: [2500, 3500], tags: ["history"] },
        { name: "Chao Phraya dinner cruise", price: [2500, 3800], tags: ["romance", "food"] },
        { name: "Safari World", price: [2600, 3300], tags: ["family", "theme_parks"] },
        { name: "Thai cooking class", price: [2200, 3e3], tags: ["food"] }
      ],
      ideas: [
        { text: "Chatuchak weekend market", tags: ["shopping"] },
        { text: "Pratunam and Platinum mall shopping", tags: ["shopping"] },
        { text: "Chinatown (Yaowarat) street food night", tags: ["food", "nightlife"] },
        { text: "ICONSIAM and the riverside night market", tags: ["shopping", "food"] }
      ],
      alternatives: ["singapore", "hongkong", "bali"]
    },
    {
      code: "dubai",
      name: "Dubai",
      country: "United Arab Emirates",
      region: "Middle East",
      domestic: false,
      aliases: ["dubai", "uae", "abu dhabi", "emirates"],
      flight: [26e3, 42e3],
      flight_note: "Round-trip economy, direct",
      peak_months: [12, 1, 2, 3],
      low_months: [6, 7, 8],
      min_days: 4,
      best_days: [5, 7],
      hotels: {
        budget: { rate: [4500, 6500], area: "Deira or Al Barsha", why: "Budget-friendly with the Metro and the old souks nearby.", stay: "Sample 3-star hotel in Deira" },
        mid: { rate: [8e3, 12e3], area: "Business Bay", why: "Close to Downtown and the Dubai Mall for less.", stay: "Sample 4-star hotel in Business Bay" },
        luxury: { rate: [22e3, 4e4], area: "Downtown or Palm Jumeirah", why: "Burj Khalifa views or a private-beach resort on the Palm.", stay: "Sample 5-star resort on the Palm" }
      },
      transfer: [3e3, 4500],
      transfer_per_person: false,
      local: [700, 1100],
      local_note: "Metro and taxis",
      insurance_required: false,
      visa: { needed: true, fee: [6500, 8500], label: "UAE tourist visa", note: "Usually processed in about 1 week.", docs: ["Passport valid at least 6 months", "Passport-size photo with white background", "Confirmed return ticket", "Hotel booking", "Bank statements (if asked)"] },
      tours: [
        { name: "Desert safari with BBQ dinner", price: [3e3, 4500], tags: ["nature", "family", "food"] },
        { name: "Burj Khalifa observation deck", price: [2800, 4200], tags: ["romance", "family"] },
        { name: "Dhow dinner cruise", price: [2200, 3200], tags: ["romance", "food"] },
        { name: "Abu Dhabi city and grand mosque tour", price: [4500, 6500], tags: ["history"] },
        { name: "Dubai Frame", price: [800, 1100], tags: ["family"] },
        { name: "Museum of the Future", price: [2600, 3e3], tags: ["family", "history"] }
      ],
      ideas: [
        { text: "Dubai Mall, the fountain show and aquarium window", tags: ["shopping", "family"] },
        { text: "Gold and spice souks with an abra boat ride", tags: ["shopping", "history"] },
        { text: "JBR beach and Dubai Marina walk", tags: ["beach", "romance"] },
        { text: "Global Village (in season) at night", tags: ["food", "shopping", "family"] }
      ],
      alternatives: ["bangkok", "singapore", "seoul"]
    },
    {
      code: "bali",
      name: "Bali",
      country: "Indonesia",
      region: "Southeast Asia",
      domestic: false,
      aliases: ["bali", "indonesia", "ubud", "seminyak"],
      flight: [14e3, 24e3],
      flight_note: "Round-trip economy, usually one stop",
      peak_months: [7, 8, 12],
      low_months: [2, 3, 11],
      min_days: 4,
      best_days: [5, 7],
      hotels: {
        budget: { rate: [2500, 4e3], area: "Kuta or Legian", why: "Near the airport and the beach, with lots of cheap food.", stay: "Sample 3-star hotel in Legian" },
        mid: { rate: [5e3, 8e3], area: "Seminyak or Ubud", why: "Beach clubs in Seminyak or jungle views in Ubud.", stay: "Sample 4-star resort in Seminyak" },
        luxury: { rate: [14e3, 28e3], area: "Nusa Dua or an Ubud pool villa", why: "Private pool villas and calm beaches, ideal for couples.", stay: "Sample 5-star pool villa" }
      },
      transfer: [1800, 2800],
      transfer_per_person: false,
      local: [800, 1200],
      local_note: "Shared driver for day trips",
      insurance_required: false,
      visa: { needed: false, fee: [800, 900], label: "No visa needed for short visits (Bali tourist levy applies)", note: "Philippine passport holders can usually visit visa-free. Bali charges a tourist levy paid online.", docs: ["Passport valid at least 6 months", "Return ticket and hotel booking", "Bali tourist levy paid online", "Arrival declaration filled online"] },
      tours: [
        { name: "Ubud rice terraces and monkey forest", price: [2200, 3200], tags: ["nature", "family"] },
        { name: "Nusa Penida day trip", price: [3800, 5200], tags: ["beach", "nature"] },
        { name: "Mt. Batur sunrise trek", price: [2800, 3800], tags: ["nature"] },
        { name: "Uluwatu temple and Kecak fire dance", price: [1800, 2600], tags: ["history", "romance"] },
        { name: "Balinese spa and massage", price: [1500, 2500], tags: ["romance"] },
        { name: "Snorkeling at Blue Lagoon", price: [2e3, 3e3], tags: ["beach"] }
      ],
      ideas: [
        { text: "Seminyak beach sunset and beach club", tags: ["beach", "romance", "nightlife"] },
        { text: "Tanah Lot temple at sunset", tags: ["history", "romance"] },
        { text: "Ubud art market and cafes", tags: ["shopping", "food"] },
        { text: "Free pool and spa day", tags: ["romance"] }
      ],
      alternatives: ["bangkok", "palawan", "boracay"]
    },
    {
      code: "taiwan",
      name: "Taiwan (Taipei)",
      country: "Taiwan",
      region: "East Asia",
      domestic: false,
      aliases: ["taiwan", "taipei", "taichung", "kaohsiung"],
      flight: [8e3, 16e3],
      flight_note: "Round-trip economy, direct",
      peak_months: [12, 2, 4],
      low_months: [6, 9],
      min_days: 3,
      best_days: [4, 6],
      hotels: {
        budget: { rate: [3e3, 4500], area: "Ximending", why: "Young, busy area with cheap rooms and street food.", stay: "Sample 3-star hotel in Ximending" },
        mid: { rate: [5500, 8500], area: "Zhongshan", why: "Calm, central and on the MRT red line.", stay: "Sample 4-star hotel in Zhongshan" },
        luxury: { rate: [14e3, 24e3], area: "Xinyi", why: "Next to Taipei 101 and the best malls.", stay: "Sample 5-star hotel in Xinyi" }
      },
      transfer: [3e3, 4500],
      transfer_per_person: false,
      local: [500, 800],
      local_note: "MRT and EasyCard",
      insurance_required: false,
      visa: { needed: false, fee: [0, 2500], label: "Visa-free entry or a Taiwan visa, depending on current rules", note: "Taiwan has allowed visa-free visits for Philippine passports on a trial basis in past years. Check if it is still in place; if not, a visa is needed.", docs: ["Passport valid at least 6 months", "Online arrival card", "Return ticket and hotel booking", "Visa or eligible visa (only if the visa-free trial has ended)"] },
      tours: [
        { name: "Jiufen old street and Shifen sky lanterns", price: [2200, 3200], tags: ["history", "romance"] },
        { name: "Taipei 101 observatory", price: [1e3, 1300], tags: ["family", "romance"] },
        { name: "Yehliu Geopark coast tour", price: [1500, 2200], tags: ["nature"] },
        { name: "Taroko Gorge day trip", price: [5500, 7500], tags: ["nature"] },
        { name: "Night market food tour", price: [1800, 2600], tags: ["food", "nightlife"] },
        { name: "Sun Moon Lake day trip", price: [3500, 5e3], tags: ["nature", "romance"] }
      ],
      ideas: [
        { text: "Shilin and Raohe night markets", tags: ["food", "nightlife"] },
        { text: "Chiang Kai-shek Memorial Hall and Longshan Temple", tags: ["history"] },
        { text: "Ximending shopping and bubble tea crawl", tags: ["shopping", "food"] },
        { text: "Beitou hot springs", tags: ["nature", "romance"] }
      ],
      alternatives: ["hongkong", "seoul", "japan"]
    },
    {
      code: "boracay",
      name: "Boracay",
      country: "Philippines",
      region: "Philippines",
      domestic: true,
      aliases: ["boracay", "bora", "aklan", "caticlan"],
      flight: [5e3, 1e4],
      flight_note: "Manila to Caticlan round trip, economy",
      peak_months: [3, 4, 5, 12],
      low_months: [7, 8, 9],
      min_days: 3,
      best_days: [4, 5],
      hotels: {
        budget: { rate: [2500, 4e3], area: "Station 3", why: "Quieter end of White Beach with the lowest rates.", stay: "Sample 3-star beach-area hotel" },
        mid: { rate: [5500, 8500], area: "Station 2", why: "Right in the middle of White Beach, D'Mall and the restaurants.", stay: "Sample 4-star resort at Station 2" },
        luxury: { rate: [14e3, 28e3], area: "Station 1 or Diniwid", why: "The widest, finest stretch of sand and the best sunsets.", stay: "Sample 5-star beachfront resort" }
      },
      transfer: [1200, 1800],
      transfer_per_person: true,
      local: [300, 500],
      local_note: "E-trikes around the island",
      insurance_required: false,
      visa: { needed: false, fee: [0, 0], label: "No visa needed (local trip)", note: "Bring a valid ID. Boat and environmental fees are included in the transfer.", docs: ["Valid government ID for every adult", "Hotel booking confirmation (checked at the port)", "Birth certificate or school ID for kids"] },
      tours: [
        { name: "Island hopping with snorkeling", price: [1200, 1800], tags: ["beach", "family"] },
        { name: "Helmet diving", price: [800, 1200], tags: ["beach"] },
        { name: "Parasailing", price: [2500, 3500], tags: ["beach", "romance"] },
        { name: "Sunset paraw sailing", price: [700, 1200], tags: ["romance", "beach"] },
        { name: "Mt. Luho viewpoint and ATV ride", price: [1500, 2500], tags: ["nature", "family"] }
      ],
      ideas: [
        { text: "White Beach swim and D'Mall food trip", tags: ["beach", "food", "shopping"] },
        { text: "Puka Shell Beach and Ilig-Iligan", tags: ["beach", "nature"] },
        { text: "Sunset dinner by the beach", tags: ["romance", "food"] },
        { text: "Free beach and spa day", tags: ["beach", "romance"] }
      ],
      alternatives: ["palawan", "bali"]
    },
    {
      code: "palawan",
      name: "El Nido, Palawan",
      country: "Philippines",
      region: "Philippines",
      domestic: true,
      aliases: ["palawan", "el nido", "elnido", "coron", "puerto princesa"],
      flight: [7e3, 14e3],
      flight_note: "Manila to Puerto Princesa round trip, economy",
      peak_months: [3, 4, 5, 12],
      low_months: [7, 8, 9],
      min_days: 4,
      best_days: [5, 6],
      hotels: {
        budget: { rate: [2500, 3800], area: "El Nido town", why: "Walk to the boat port and the restaurants.", stay: "Sample 3-star hotel in El Nido town" },
        mid: { rate: [5500, 9e3], area: "Corong-Corong", why: "Quieter bay with sunset views, a short ride to town.", stay: "Sample 4-star resort in Corong-Corong" },
        luxury: { rate: [15e3, 32e3], area: "a private island resort", why: "Island resort with its own beach and boat transfers.", stay: "Sample 5-star island resort" }
      },
      transfer: [1100, 1600],
      transfer_per_person: true,
      local: [300, 500],
      local_note: "Tricycles around town",
      insurance_required: false,
      visa: { needed: false, fee: [0, 0], label: "No visa needed (local trip)", note: "Bring a valid ID. The eco-tourism fee is paid on arrival.", docs: ["Valid government ID for every adult", "Hotel booking confirmation", "Birth certificate or school ID for kids"] },
      tours: [
        { name: "El Nido island-hopping Tour A (lagoons)", price: [1400, 1800], tags: ["beach", "nature", "family"] },
        { name: "El Nido island-hopping Tour C (hidden beaches)", price: [1600, 2e3], tags: ["beach", "nature"] },
        { name: "Underground River day trip", price: [2500, 3500], tags: ["nature", "family"] },
        { name: "Las Cabanas zipline", price: [800, 1e3], tags: ["nature", "romance"] },
        { name: "Nacpan Beach day", price: [800, 1200], tags: ["beach"] }
      ],
      ideas: [
        { text: "Las Cabanas sunset", tags: ["romance", "beach"] },
        { text: "El Nido town food crawl", tags: ["food"] },
        { text: "Free beach and rest day", tags: ["beach"] }
      ],
      alternatives: ["boracay", "bali"]
    }
  ]
};

// src/quote/engine.ts
var RULES = catalog_default.rules;
var TIERS = catalog_default.tiers;
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var r100 = (x) => Math.floor(x / 100 + 0.5) * 100;
var rint = (x) => Math.floor(x + 0.5);
var peso = (n) => (n < 0 ? "-" : "") + "\u20B1" + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
var destByCode = (code) => catalog_default.destinations.find((d) => d.code === code) ?? null;
var plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
var paxText = (a, k) => [plural(a, "adult"), k ? k === 1 ? "1 child" : `${k} children` : ""].filter(Boolean).join(" and ");
var NUM_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  isa: 1,
  isang: 1,
  dalawa: 2,
  dalawang: 2,
  tatlo: 3,
  tatlong: 3,
  apat: 4,
  lima: 5,
  limang: 5,
  anim: 6,
  pito: 7,
  pitong: 7,
  walo: 8,
  walong: 8,
  siyam: 9,
  sampu: 10,
  sampung: 10,
  a: 1
};
var NUM = "(\\d+|" + Object.keys(NUM_WORDS).join("|") + ")";
var toNum = (s) => /^\d+$/.test(s) ? parseInt(s, 10) : NUM_WORDS[s] ?? NaN;
var MONTH_RE = [
  [/\b(jan|january|enero)\b/, 1],
  [/\b(feb|february|pebrero)\b/, 2],
  [/\b(mar|march|marso)\b/, 3],
  [/\b(apr|april|abril)\b/, 4],
  [/\b(may\s+\d{1,2}|(in|this|next|ngayong|sa buwan ng)\s+may|may\s+20\d\d|mayo)\b/, 5],
  [/\b(jun|june|hunyo)\b/, 6],
  [/\b(jul|july|hulyo)\b/, 7],
  [/\b(aug|august|agosto)\b/, 8],
  [/\b(sep|sept|september|setyembre)\b/, 9],
  [/\b(oct|october|oktubre)\b/, 10],
  [/\b(nov|november|nobyembre)\b/, 11],
  [/\b(dec|december|disyembre)\b/, 12],
  [/\b(christmas|pasko|xmas)\b/, 12],
  [/\b(new year|bagong taon)\b/, 1],
  [/\b(holy week|semana santa|mahal na araw|summer|tag-init)\b/, 4]
];
var MONTH_NAMES = "jan|january|enero|feb|february|pebrero|mar|march|marso|apr|april|abril|may|mayo|jun|june|hunyo|jul|july|hulyo|aug|august|agosto|sep|sept|september|setyembre|oct|october|oktubre|nov|november|nobyembre|dec|december|disyembre";
function monthOf(word) {
  for (const [re, m] of MONTH_RE) if (re.test(word) || re.test(" in " + word + " ")) return m;
  return null;
}
function parseRequest(raw, today) {
  const t = " " + raw.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim() + " ";
  const out = { destination: null, place_text: null, days: null, adults: null, kids: null, tier: null, budget: null, budget_per_person: false, month: null, travel_date: null, interests: [], understood: [] };
  let best = Infinity;
  for (const d of catalog_default.destinations) for (const a of d.aliases) {
    const m2 = new RegExp("\\b" + a.replace(/ /g, "\\s") + "\\b").exec(t);
    if (m2 && m2.index < best) {
      best = m2.index;
      out.destination = d.code;
    }
  }
  if (!out.destination) {
    const m2 = /(?:pumunta|punta|go|travel|trip|fly|visit|tour)\s+(?:sa|to|in)?\s*([A-Z][\w'-]+(?:\s[A-Z][\w'-]+)?)/.exec(" " + raw + " ");
    if (m2 && !/^(I|Ako|Kami|We)$/.test(m2[1])) out.place_text = m2[1];
  }
  const range = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s*(\\d{1,2})\\s*(?:-|to|hanggang)\\s*(?:(${MONTH_NAMES})\\.?\\s*)?(\\d{1,2})\\b`).exec(t);
  if (range) {
    const m1 = monthOf(range[1]), m2 = range[3] ? monthOf(range[3]) : m1;
    const d1 = parseInt(range[2], 10), d2 = parseInt(range[4], 10);
    const year = nextYearFor(m1, d1, today);
    const start = Date.UTC(year, m1 - 1, d1), end = Date.UTC(m2 < m1 ? year + 1 : year, m2 - 1, d2);
    if (end > start && d1 <= 31) {
      out.days = Math.round((end - start) / 864e5) + 1;
      out.month = m1;
      out.travel_date = new Date(start).toISOString().slice(0, 10);
    }
  }
  if (!out.travel_date) {
    const single = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:days?|nights?|araw|gabi|pax|adults?|kids?))`).exec(t);
    if (single && parseInt(single[2], 10) <= 31) {
      const m1 = monthOf(single[1]), d1 = parseInt(single[2], 10);
      out.month = m1;
      out.travel_date = new Date(Date.UTC(nextYearFor(m1, d1, today), m1 - 1, d1)).toISOString().slice(0, 10);
    }
  }
  if (!out.month) {
    for (const [re, m2] of MONTH_RE) if (re.test(t)) {
      out.month = m2;
      break;
    }
  }
  if (out.days === null) {
    let m2 = /\b(\d+)\s*d\s*(\d+)\s*n\b/.exec(t) || /\b(\d+)\s*n\s*(\d+)\s*d\b/.exec(t);
    if (m2) {
      const a = parseInt(m2[1], 10), b = parseInt(m2[2], 10);
      out.days = Math.max(a, b);
    } else if (m2 = new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:nights?|gabi)\\b`).exec(t)) out.days = toNum(m2[1]) + 1;
    else if (m2 = new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:days?|araw)\\b`).exec(t)) out.days = toNum(m2[1]);
    else if (m2 = new RegExp(`\\b${NUM}\\s*(?:-\\s*)?(?:weeks?|linggo)\\b`).exec(t)) out.days = toNum(m2[1]) * 7;
  }
  let m;
  if (m = new RegExp(`\\b${NUM}\\s*(?:adults?|matanda)\\b`).exec(t)) out.adults = toNum(m[1]);
  if (m = new RegExp(`\\b${NUM}\\s*(?:kids?|children|child|bata|anak|chikiting)\\b`).exec(t)) out.kids = toNum(m[1]);
  if ((m = /\bfamily of (\d+)\b/.exec(t)) && out.adults === null) {
    const n = parseInt(m[1], 10);
    out.adults = Math.min(2, n);
    out.kids = out.kids ?? Math.max(0, n - 2);
  }
  if ((m = new RegExp(`\\b${NUM}\\s*(?:pax|people|persons?|tao|katao|travell?ers?|guests?)\\b`).exec(t)) && out.adults === null) {
    const n = toNum(m[1]);
    out.adults = Math.max(1, n - (out.kids ?? 0));
  }
  if (out.adults === null) {
    if (/\b(couple|honeymoon|mag-asawa|mag asawa|asawa ko|my (wife|husband|partner|boyfriend|girlfriend)|jowa|kami ni|kaming dalawa)\b/.test(t)) out.adults = 2;
    else if (/\b(solo|ako lang|mag-isa|mag isa|alone|just me|by myself)\b/.test(t)) out.adults = 1;
    else if (/\b(kami|we|us|namin|our|tayo)\b/.test(t)) out.adults = 2;
    else if (/\b(ako|ko|i|me|my)\b/.test(t) && !/\b(family|pamilya|barkada|friends)\b/.test(t)) out.adults = 1;
  }
  if (/\b(5|five)[\s-]?stars?\b|5\*|\b(luxury|luxurious|sosyal|premium|high[\s-]?end|bongga)\b/.test(t)) out.tier = "luxury";
  else if (/\b(4|four)[\s-]?stars?\b|\b(mid[\s-]?range|midrange|mid|sakto lang|comfortable)\b/.test(t)) out.tier = "mid";
  else if (/\b(budget[\s-]?friendly|budget lang|budget hotel|budget trip|on a budget|cheap|cheapest|tipid|mura|pinakamura|affordable|hostel|low[\s-]?cost|(3|three)[\s-]?stars?)\b/.test(t)) out.tier = "budget";
  const money = /(?<![a-z])(?:₱|php|p)\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b|\b(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million|libo|pesos?|php)\b/.exec(t);
  if (money) {
    const n = parseFloat((money[1] ?? money[3]).replace(/,/g, ""));
    const unit = money[2] ?? money[4] ?? "";
    const mult = unit === "k" || unit === "thousand" || unit === "libo" ? 1e3 : unit === "m" || unit === "million" ? 1e6 : 1;
    const amount = rint(n * mult);
    if (amount >= 1e3) {
      out.budget = amount;
      out.budget_per_person = /\b(per (person|pax|head|tao)|each|bawat isa|kada (isa|tao)|isang tao)\b|\/\s?(pax|person|head)/.test(t);
    }
  }
  for (const [k, words] of Object.entries(catalog_default.interests)) if (words.some((w) => new RegExp("\\b" + w + "\\b").test(t))) out.interests.push(k);
  out.understood = describe(out);
  return out;
}
function nextYearFor(month, day, today) {
  const y = parseInt(today.slice(0, 4), 10);
  return Date.UTC(y, month - 1, day) >= Date.parse(today.slice(0, 10)) ? y : y + 1;
}
function describe(p) {
  const u = [];
  const d = destByCode(p.destination);
  if (d) u.push(`Going to ${d.name}`);
  else if (p.place_text) u.push(`Going to ${p.place_text} (no sample rates yet)`);
  if (p.days) u.push(`${p.days} days, ${p.days - 1} nights`);
  if (p.travel_date) u.push(`Leaving ${fmtDay(p.travel_date)}`);
  else if (p.month) u.push(`Travelling in ${MONTHS[p.month - 1]}`);
  if (p.adults !== null || p.kids !== null) u.push(paxText(p.adults ?? 1, p.kids ?? 0));
  if (p.tier) u.push(`${TIERS[p.tier].label} hotel`);
  if (p.budget) u.push(`Budget ${peso(p.budget)}${p.budget_per_person ? " per person" : " in total"}`);
  if (p.interests.length) u.push("Likes " + p.interests.map((i) => i.replace("_", " ")).join(", "));
  return u;
}
var fmtDay = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
};
function normalize(p, rules = RULES) {
  const a = [];
  let days = p.days ?? null;
  if (!days) {
    days = rules.default_days;
    a.push(`No trip length given, so we used ${days} days.`);
  }
  days = Math.min(rules.max_days, Math.max(rules.min_days, Math.floor(days)));
  let adults = p.adults ?? null;
  if (!adults || adults < 1) {
    adults = 1;
    a.push("Number of travellers not given, so we priced it for 1 adult.");
  }
  const kids = Math.max(0, Math.floor(p.kids ?? 0));
  let month = p.month ?? null;
  if (p.travel_date) month = parseInt(p.travel_date.slice(5, 7), 10);
  const interests = [...p.interests ?? []];
  if (kids > 0 && !interests.includes("family")) interests.push("family");
  if (!p.tier) a.push("No hotel level chosen, so we compared all three.");
  return {
    input: {
      destination: p.destination ?? null,
      place_text: p.place_text ?? null,
      days,
      adults: Math.floor(adults),
      kids,
      tier: p.tier ?? null,
      budget: p.budget && p.budget > 0 ? rint(p.budget) : null,
      budget_per_person: !!p.budget_per_person,
      month,
      travel_date: p.travel_date ?? null,
      interests
    },
    assumptions: a
  };
}
function seasonOf(d, month, rules = RULES) {
  if (!month) return { kind: "regular", label: "Regular season (no travel month given)", month: null };
  const ph = rules.ph_peak[String(month)];
  if (ph) return { kind: "peak", label: `Peak season: ${ph}`, month };
  if (d.peak_months.includes(month)) return { kind: "peak", label: `Peak season: busy month in ${d.name}`, month };
  if (d.low_months.includes(month)) return { kind: "low", label: `Off-peak: quieter month in ${d.name}`, month };
  return { kind: "regular", label: `Regular season (${MONTHS[month - 1]})`, month };
}
var score = (tags, interests) => tags.filter((x) => interests.includes(x)).length;
function rank(items, interests) {
  return items.map((x, i) => ({ x, i, s: score(x.tags, interests) })).sort((a, b) => b.s - a.s || a.i - b.i).map((o) => o.x);
}
function priceOption(d, inp, opt, rules = RULES) {
  const tier = opt.tier;
  const { adults, kids, days } = inp;
  const pax = adults + kids, nights = days - 1;
  const rooms = Math.max(1, Math.ceil(adults / 2), Math.ceil(pax / 4));
  const lines = [];
  const add = (kind, label, detail, lo, hi) => lines.push({ kind, label, detail, low: r100(lo), high: r100(hi) });
  const season = seasonOf(d, inp.month, rules);
  const fp = adults + kids * rules.kid_flight_factor;
  add("flight", "Flights", `${d.flight_note}, ${paxText(adults, kids)}${kids ? " (children about 25% less)" : ""}`, d.flight[0] * fp, d.flight[1] * fp);
  const h = d.hotels[tier];
  add("hotel", "Hotel", `${h.stay}, ${plural(nights, "night")} x ${plural(rooms, "room")}${kids ? ", kids share with parents" : ""}`, h.rate[0] * nights * rooms, h.rate[1] * nights * rooms);
  const nTours = days >= 3 ? Math.min(d.tours.length, Math.max(1, rint((days - 2) * opt.tour_share))) : 0;
  const tours = rank(d.tours, inp.interests).slice(0, nTours);
  if (tours.length) {
    const tp = adults + kids * rules.kid_tour_factor;
    add(
      "tours",
      "Tours and activities",
      tours.map((x) => x.name).join("; ") + (kids ? " (children about half price)" : ""),
      tours.reduce((s, x) => s + x.price[0], 0) * tp,
      tours.reduce((s, x) => s + x.price[1], 0) * tp
    );
  }
  const vehicles = d.transfer_per_person ? pax : Math.ceil(pax / 4);
  const tf = opt.code === "premium" ? rules.premium_transfer_factor : 1;
  add(
    "transfer",
    opt.code === "premium" ? "Private airport transfers" : "Airport transfers",
    d.transfer_per_person ? `Round trip, per person (boat, van and port fees)` : `Round trip, ${plural(vehicles, "vehicle")}`,
    d.transfer[0] * vehicles * tf,
    d.transfer[1] * vehicles * tf
  );
  const lp = adults + kids * rules.kid_local_factor;
  add("local", "Local transport", `${d.local_note}, ${plural(days, "day")}`, d.local[0] * days * lp, d.local[1] * days * lp);
  if (d.visa.fee[1] > 0) add("visa", d.visa.needed ? "Visa processing" : "Entry fees", `${d.visa.label}, ${plural(pax, "traveller")}`, d.visa.fee[0] * pax, d.visa.fee[1] * pax);
  if (d.insurance_required) {
    const ins = d.domestic ? rules.insurance_per_day.domestic : rules.insurance_per_day.international;
    add("insurance", "Travel insurance (required)", `Required for this visa, ${plural(days, "day")} x ${plural(pax, "traveller")}`, ins[0] * days * pax, ins[1] * days * pax);
  }
  const fl = lines.find((l) => l.kind === "flight"), ht = lines.find((l) => l.kind === "hotel");
  if (season.kind === "peak") add("peak", "Peak-season surcharge", `${season.label.replace("Peak season: ", "")}: flights and hotels cost about ${rules.peak_surcharge_pct}% more`, (fl.low + ht.low) * rules.peak_surcharge_pct / 100, (fl.high + ht.high) * rules.peak_surcharge_pct / 100);
  if (season.kind === "low") add("offpeak", "Off-peak saving", `Quieter month: flights and hotels about ${rules.offpeak_saving_pct}% cheaper`, -(fl.low + ht.low) * rules.offpeak_saving_pct / 100, -(fl.high + ht.high) * rules.offpeak_saving_pct / 100);
  if (pax >= rules.group_size) {
    const tr = lines.find((l) => l.kind === "tours");
    add("group", "Group discount", `${pax} travellers: ${rules.group_discount_pct}% off hotel and tours`, -(ht.low + (tr?.low ?? 0)) * rules.group_discount_pct / 100, -(ht.high + (tr?.high ?? 0)) * rules.group_discount_pct / 100);
  }
  const sub_lo = lines.reduce((s, l) => s + l.low, 0), sub_hi = lines.reduce((s, l) => s + l.high, 0);
  const fee_lo = r100(Math.max(rules.service_fee_min, sub_lo * rules.service_fee_pct / 100)), fee_hi = r100(Math.max(rules.service_fee_min, sub_hi * rules.service_fee_pct / 100));
  lines.push({ kind: "fee", label: "PAPH service fee", detail: `Planning, booking and 24/7 trip support (${rules.service_fee_pct}%)`, low: fee_lo, high: fee_hi });
  const total_lo = sub_lo + fee_lo, total_hi = sub_hi + fee_hi;
  return {
    code: opt.code,
    label: opt.label,
    tier,
    tier_label: TIERS[tier].label,
    blurb: opt.blurb,
    lines,
    subtotal_low: sub_lo,
    subtotal_high: sub_hi,
    total_low: total_lo,
    total_high: total_hi,
    pp_low: r100(total_lo / pax),
    pp_high: r100(total_hi / pax),
    fit: null,
    recommended: false,
    hotel: { area: h.area, why: h.why, stay: h.stay, rooms, nights, rate: h.rate },
    tours: tours.map((x) => x.name),
    itinerary: itinerary(d, inp, h.area, tours, opt.code === "premium")
  };
}
function itinerary(d, inp, area, tours, priv) {
  const days = [{ day: 1, title: "Arrival", text: `Fly from Manila to ${d.name}. ${priv ? "Private car" : "Transfer"} to your hotel in ${area}, check in and rest. Easy walk around the area in the evening.` }];
  const middle = Math.max(0, inp.days - 2);
  const slots = Array(middle).fill(null);
  tours.forEach((t, j) => {
    slots[Math.floor(j * middle / tours.length)] = t;
  });
  const ideas = rank(d.ideas, inp.interests);
  let k = 0;
  slots.forEach((t, i) => {
    if (t) days.push({ day: i + 2, title: t.name, text: `${t.name}, with a guide and entrance fees. The rest of the day is free.` });
    else if (k < ideas.length) {
      const idea = ideas[k++];
      days.push({ day: i + 2, title: "Free day", text: idea.text + "." });
    } else days.push({ day: i + 2, title: "Free day", text: "Explore at your own pace, or add an extra tour." });
  });
  if (inp.days >= 2) days.push({ day: inp.days, title: "Going home", text: "Free morning for last-minute shopping, check out, transfer to the airport and fly home to Manila." });
  return days;
}
function budgetTotal(inp) {
  return inp.budget === null ? null : inp.budget_per_person ? inp.budget * (inp.adults + inp.kids) : inp.budget;
}
var fitOf = (o, b) => b >= o.total_high ? "fits" : b >= o.total_low ? "tight" : "over";
var optionFor = (tier) => catalog_default.options.find((o) => o.tier === tier);
function recommend(inputOrParsed, rules = RULES) {
  const { input, assumptions } = normalize(inputOrParsed, rules);
  const d = destByCode(input.destination);
  const base = { input, assumptions, notice: catalog_default.notice, version: catalog_default.version };
  if (!d) {
    const where = input.place_text ? `${input.place_text}` : "";
    return {
      ...base,
      kind: "manual",
      destination: null,
      season: { kind: "regular", label: "", month: input.month },
      options: [],
      recommended: null,
      budget: null,
      visa: null,
      addons: [],
      verdict: where ? `We don't have sample rates for ${where} yet, so a PAPH travel consultant will price this trip for you.` : "Tell us where you would like to go, and a PAPH travel consultant will price the trip for you."
    };
  }
  const season = seasonOf(d, input.month, rules);
  if (input.days < d.min_days) assumptions.push(`${d.name} is best with at least ${d.min_days} days; ${input.days} days will feel rushed.`);
  const options = catalog_default.options.map((o) => priceOption(d, input, o, rules));
  const B = budgetTotal(input);
  let rec;
  if (input.tier) rec = options.find((o) => o.tier === input.tier);
  else if (B !== null) rec = [...options].reverse().find((o) => o.total_low <= B) ?? options[0];
  else rec = options.find((o) => o.code === "value");
  rec.recommended = true;
  if (B !== null) options.forEach((o) => {
    o.fit = fitOf(o, B);
  });
  const head = `${d.name}, ${input.days} days, ${rec.tier_label.toLowerCase()} hotel: about ${peso(rec.pp_low)} to ${peso(rec.pp_high)} per person`;
  let verdict = input.adults + input.kids > 1 ? `${head} (${peso(rec.total_low)} to ${peso(rec.total_high)} for ${paxText(input.adults, input.kids)}).` : `${head}.`;
  let budget = null;
  if (B !== null) budget = checkBudget(d, input, options, rec, B, rules);
  if (budget?.status === "over") verdict = budget.message;
  else if (budget?.status === "tight") verdict = `${head}. Your ${peso(B)} budget fits the lower end of the range.`;
  else if (budget?.status === "fits") verdict = `${head}. This fits your ${peso(B)} budget.`;
  return {
    ...base,
    kind: "priced",
    destination: { code: d.code, name: d.name, country: d.country, region: d.region, domestic: d.domestic },
    season,
    options,
    recommended: rec.code,
    verdict,
    budget,
    visa: { needed: d.visa.needed, label: d.visa.label, note: d.visa.note, docs: d.visa.docs, fee: d.visa.fee },
    addons: addonsFor(d, input, rec, rules)
  };
}
function checkBudget(d, inp, options, rec, B, rules) {
  const status = fitOf(rec, B);
  const cheapest = options[0];
  if (status !== "over") {
    const msg = status === "fits" ? `Your ${peso(B)} budget covers this option with about ${peso(B - rec.total_high)} to spare.` : `Your ${peso(B)} budget fits the lower end of this range.`;
    return { budget_total: B, status, message: msg, shortfall: 0, ideas: [], best: null };
  }
  const ideas = [];
  const mk = (kind, title, detail, dest, tier, days, month) => {
    const q = priceOption(dest, { ...inp, destination: dest.code, days, month, travel_date: month === inp.month ? inp.travel_date : null }, optionFor(tier), rules);
    return { kind, title, detail, destination: dest.code, tier, days, month, total_low: q.total_low, total_high: q.total_high, diff: B - q.total_low, fits: q.total_low <= B };
  };
  const lower = options.filter((o) => o.total_low < rec.total_low).reverse();
  const tierFit = lower.find((o) => o.total_low <= B);
  if (tierFit) ideas.push(mk("tier", `${tierFit.label} hotel instead`, `${d.name} for ${inp.days} days with a ${tierFit.tier_label.toLowerCase()} hotel.`, d, tierFit.tier, inp.days, inp.month));
  const minD = Math.max(rules.min_days, Math.min(d.min_days, inp.days - 1));
  for (const tier of Array.from(/* @__PURE__ */ new Set([rec.tier, "budget"]))) {
    let found = null;
    for (let n = inp.days - 1; n >= minD; n--) {
      const f = mk("days", `${n} days instead of ${inp.days}`, `${d.name} for ${n} days with a ${TIERS[tier].label.toLowerCase()} hotel.`, d, tier, n, inp.month);
      if (f.fits) {
        found = f;
        break;
      }
    }
    if (found) {
      ideas.push(found);
      break;
    }
  }
  const season = seasonOf(d, inp.month, rules);
  if (season.kind !== "low" && d.low_months.length) {
    const lm = d.low_months[0];
    for (const tier of Array.from(/* @__PURE__ */ new Set([rec.tier, "budget"]))) {
      const f = mk("month", `Travel in ${MONTHS[lm - 1]} instead`, `${d.name} in ${MONTHS[lm - 1]} (off-peak) for ${inp.days} days with a ${TIERS[tier].label.toLowerCase()} hotel.`, d, tier, inp.days, lm);
      if (f.fits || tier === "budget") {
        ideas.push(f);
        break;
      }
    }
  }
  const alts = [];
  for (const a of d.alternatives.map((c) => destByCode(c)).filter(Boolean)) {
    for (let n = inp.days; n >= Math.max(rules.min_days, Math.min(a.min_days, inp.days)); n--) {
      const f = mk("destination", `${a.name} instead`, `${a.name} for ${n} days with a budget hotel.`, a, "budget", n, inp.month);
      if (f.fits) {
        alts.push(f);
        break;
      }
    }
  }
  alts.sort((x, y) => y.days - x.days || x.diff - y.diff);
  ideas.push(...alts.slice(0, 2));
  const best = ideas.find((i) => i.fits) ?? null;
  const shortfall = cheapest.total_low - B;
  const short = `Your ${peso(B)} budget is ${peso(rec.total_low - B)} short of the lowest price for ${d.name}, ${inp.days} days, ${rec.tier_label.toLowerCase()} hotel (${peso(rec.total_low)}).`;
  const message = best ? `${short} Nearest fit: ${best.detail.replace(/\.$/, "")}, from ${peso(best.total_low)} (${peso(best.diff)} under your budget).` : `${short} Even the simplest version needs at least ${peso(cheapest.total_low)}, so you would need ${peso(Math.max(0, shortfall))} more.`;
  return { budget_total: B, status, message, shortfall: Math.max(0, shortfall), ideas, best };
}
function addonsFor(d, inp, rec, rules) {
  const pax = inp.adults + inp.kids, out = [];
  const cat = Object.fromEntries(catalog_default.addons.map((a) => [a.code, a]));
  if (!d.insurance_required) {
    const ins = d.domestic ? rules.insurance_per_day.domestic : rules.insurance_per_day.international;
    out.push({ code: "insurance", label: cat.insurance.label, detail: cat.insurance.detail, unit: `${plural(pax, "traveller")}, ${plural(inp.days, "day")}`, cost: r100(ins[0] * inp.days * pax), price: r100(ins[1] * inp.days * pax) });
  }
  if (rec.code !== "premium" && !d.transfer_per_person) out.push({ code: "private_transfer", label: cat.private_transfer.label, detail: cat.private_transfer.detail, unit: "per booking", cost: cat.private_transfer.cost[0], price: cat.private_transfer.price });
  if (!d.domestic) out.push({ code: "wifi", label: cat.wifi.label, detail: cat.wifi.detail, unit: plural(inp.days, "day"), cost: r100(cat.wifi.cost[0] * inp.days), price: r100(cat.wifi.price * inp.days) });
  const tp = inp.adults + inp.kids * rules.kid_tour_factor;
  d.tours.forEach((t, i) => {
    if (rec.tours.includes(t.name)) return;
    out.push({ code: `tour:${i}`, label: `Extra tour: ${t.name}`, detail: "Guided, with entrance fees.", unit: plural(pax, "traveller"), cost: r100((t.price[0] + t.price[1]) / 2 * tp), price: r100(t.price[1] * tp) });
  });
  return out;
}

// src/quote/workflow.json
var workflow_default = {
  statuses: {
    new: { staff: "New request", customer: "Received", step: 0, open: true },
    ai_recommended: { staff: "AI recommended", customer: "Received", step: 0, open: true },
    offer_drafted: { staff: "Offer being drafted", customer: "Being prepared", step: 1, open: true },
    pending_approval: { staff: "Waiting for approval", customer: "Being prepared", step: 1, open: true },
    changes_requested: { staff: "Changes requested", customer: "Being prepared", step: 1, open: true },
    approved: { staff: "Approved, ready to send", customer: "Offer ready", step: 2, open: true },
    sent: { staff: "Sent to customer", customer: "Offer ready", step: 2, open: true },
    accepted: { staff: "Customer accepted", customer: "Accepted", step: 3, open: true },
    booked: { staff: "Booked", customer: "Booked", step: 4, open: false },
    declined: { staff: "Declined", customer: "Closed", step: -1, open: false },
    lost: { staff: "Lost", customer: "Closed", step: -1, open: false }
  },
  actions: {
    start_offer: { label: "Start the offer", from: ["new", "ai_recommended"], to: "offer_drafted", roles: ["SALES", "ADMIN"] },
    save_offer: { label: "Save the offer", from: ["offer_drafted", "changes_requested", "approved", "sent"], to: "offer_drafted", roles: ["SALES", "ADMIN"] },
    submit: { label: "Send for approval", from: ["offer_drafted", "changes_requested"], to: "pending_approval", roles: ["SALES", "ADMIN"] },
    approve: { label: "Approve", from: ["pending_approval"], to: "approved", roles: ["AGENT", "ADMIN"] },
    request_changes: { label: "Ask for changes", from: ["pending_approval"], to: "changes_requested", roles: ["AGENT", "ADMIN"], note: true },
    decline: { label: "Decline", from: ["pending_approval"], to: "declined", roles: ["AGENT", "ADMIN"], note: true },
    send: { label: "Mark as sent to customer", from: ["approved"], to: "sent", roles: ["SALES", "AGENT", "ADMIN"] },
    customer_accept: { label: "Accept the offer", from: ["approved", "sent"], to: "accepted", roles: ["CUSTOMER"] },
    customer_changes: { label: "Request changes", from: ["approved", "sent"], to: "changes_requested", roles: ["CUSTOMER"], note: true },
    customer_question: { label: "Ask a question", from: ["new", "ai_recommended", "offer_drafted", "pending_approval", "changes_requested", "approved", "sent", "accepted"], to: null, roles: ["CUSTOMER"], note: true },
    answer: { label: "Mark question answered", from: ["new", "ai_recommended", "offer_drafted", "pending_approval", "changes_requested", "approved", "sent", "accepted"], to: null, roles: ["SALES", "AGENT", "ADMIN"], note: true },
    assign: { label: "Assign", from: ["new", "ai_recommended", "offer_drafted", "pending_approval", "changes_requested", "approved", "sent", "accepted"], to: null, roles: ["SALES", "AGENT", "ADMIN"] },
    mark_booked: { label: "Mark as booked (deposit received)", from: ["accepted"], to: "booked", roles: ["SALES", "AGENT", "ADMIN"] },
    customer_feedback: { label: "Rate your trip", from: ["booked"], to: null, roles: ["CUSTOMER"] },
    mark_lost: { label: "Mark as lost", from: ["new", "ai_recommended", "offer_drafted", "changes_requested", "approved", "sent", "accepted"], to: "lost", roles: ["SALES", "AGENT", "ADMIN"], reason: true }
  },
  lost_reasons: {
    price: "Price too high",
    dates: "Dates did not work",
    other_agency: "Chose another agency",
    no_response: "No response from customer",
    plans_changed: "Trip cancelled or plans changed"
  },
  roles: {
    ADMIN: "Owner: sees and does everything",
    AGENT: "Travel agent: approves, asks for changes or declines offers",
    SALES: "Salesperson: prepares offers from the AI recommendation"
  }
};

// src/quote/workflow.ts
var STATUSES = workflow_default.statuses;
var ACTIONS = workflow_default.actions;
var LOST_REASONS = workflow_default.lost_reasons;
var ROLE_LABELS = workflow_default.roles;
var DEFAULT_SETTINGS = {
  service_fee_pct: RULES.service_fee_pct,
  min_margin_pct: RULES.min_margin_pct,
  validity_days: RULES.validity_days,
  deposit_pct: RULES.deposit_pct,
  balance_days_before: RULES.balance_days_before
};
var rulesFrom = (s) => ({ ...RULES, service_fee_pct: s.service_fee_pct, min_margin_pct: s.min_margin_pct, validity_days: s.validity_days, deposit_pct: s.deposit_pct, balance_days_before: s.balance_days_before });
var FlowError = class extends Error {
};
var fail = (msg) => {
  throw new FlowError(msg);
};
var addDays = (iso, days) => new Date(+new Date(iso) + days * 864e5).toISOString();
var round1 = (x) => Math.floor(x * 10 + 0.5) / 10;
var refFor = (year, seq) => `PAPH-${year}-${String(seq).padStart(4, "0")}`;
function createRequest(p, settings = DEFAULT_SETTINGS) {
  const name = p.customer.name.trim(), contact = p.customer.contact.trim();
  if (name.length < 2) fail("Please enter your name.");
  if (contact.length < 5) fail("Please enter a mobile number or email so we can send your offer.");
  const rec = recommend(p.input, rulesFrom(settings));
  const known = new Set(rec.addons.map((a) => a.code));
  const req = {
    id: p.id,
    ref: refFor(parseInt(p.now.slice(0, 4), 10), p.seq),
    created_at: p.now,
    updated_at: p.now,
    status: "ai_recommended",
    is_sample: !!p.is_sample,
    customer: { name: name.slice(0, 120), contact: contact.slice(0, 160) },
    raw_text: p.raw_text.slice(0, 2e3),
    input: rec.input,
    addons: p.addons.filter((a) => known.has(a)),
    recommendation: rec,
    assignee: null,
    offer: null,
    submitted_by: null,
    approval: null,
    customer_question: null,
    lost_reason: null,
    events: [],
    feedback: null
  };
  req.events.push({ at: p.now, by: req.customer.name, role: "CUSTOMER", action: "submitted", from: null, to: "new", note: "Request received." });
  req.events.push({ at: p.now, by: "PAPH AI", role: "SYSTEM", action: "ai_recommended", from: "new", to: "ai_recommended", note: rec.verdict });
  return req;
}
function offerFromOption(req, option, settings, by, now) {
  const rec = req.recommendation;
  const o = rec.options.find((x) => x.code === option) ?? null;
  const lines = [];
  let n = 1;
  if (o) for (const l of o.lines) {
    if (l.kind === "fee") continue;
    const mid = r100((l.low + l.high) / 2);
    lines.push({ id: `l${n++}`, kind: l.kind, label: l.label, detail: l.detail, cost: mid, price: mid });
  }
  for (const code of req.addons) {
    const a = rec.addons.find((x) => x.code === code);
    if (a) lines.push({ id: `l${n++}`, kind: "addon", label: a.label, detail: `${a.detail} (${a.unit})`, cost: a.cost, price: a.price });
  }
  if (lines.length) {
    const base = lines.filter((l) => l.kind !== "addon").reduce((s, l) => s + l.cost, 0);
    lines.push({ id: `l${n++}`, kind: "fee", label: "PAPH service fee", detail: `Planning, booking and 24/7 trip support (${settings.service_fee_pct}%)`, cost: 0, price: r100(Math.max(RULES.service_fee_min, base * settings.service_fee_pct / 100)) });
  }
  const offer = { option: o ? o.code : null, lines, discount: 0, notes: "", version: 1, updated_by: by, updated_at: now, totals: null };
  offer.totals = totals(req, offer, settings);
  return offer;
}
function totals(req, offer, settings) {
  const cost = offer.lines.reduce((s, l) => s + l.cost, 0);
  const price = offer.lines.reduce((s, l) => s + l.price, 0) - offer.discount;
  const margin = price - cost;
  const margin_pct = price > 0 ? round1(margin / price * 100) : 0;
  const o = req.recommendation.options.find((x) => x.code === offer.option);
  const addons = offer.lines.filter((l) => l.kind === "addon").reduce((s, l) => s + l.price, 0);
  const ai_low = o ? o.total_low + addons : 0, ai_high = o ? o.total_high + addons : 0;
  const ai_check = !o ? "none" : price < ai_low ? "below" : price > ai_high ? "above" : "inside";
  const pax = req.input.adults + req.input.kids;
  return {
    cost,
    price,
    discount: offer.discount,
    margin,
    margin_pct,
    below_cost: price < cost,
    low_margin: price >= cost && margin_pct < settings.min_margin_pct,
    ai_low,
    ai_high,
    ai_check,
    ai_gap: ai_check === "below" ? ai_low - price : ai_check === "above" ? price - ai_high : 0,
    per_person: r100(price / Math.max(1, pax))
  };
}
var isExpired = (req, now) => (req.status === "approved" || req.status === "sent") && !!req.approval && now > req.approval.valid_until;
var hoursWaiting = (req, now) => {
  if (!["new", "ai_recommended", "changes_requested"].includes(req.status) && !req.customer_question) return 0;
  const since = req.customer_question?.at ?? [...req.events].reverse().find((e) => e.to === req.status)?.at ?? req.created_at;
  return Math.max(0, (+new Date(now) - +new Date(since)) / 36e5);
};
function allowed(req, role) {
  return Object.keys(ACTIONS).filter((a) => ACTIONS[a].roles.includes(role) && ACTIONS[a].from.includes(req.status));
}
function apply(prev, action, actor, payload, now, settings = DEFAULT_SETTINGS) {
  const spec = ACTIONS[action] ?? fail("Unknown action.");
  if (!spec.roles.includes(actor.role)) fail(`Your role can't ${spec.label.toLowerCase()}.`);
  if (!spec.from.includes(prev.status)) fail(`You can't ${spec.label.toLowerCase()} while the request is "${STATUSES[prev.status].staff}".`);
  const note = (payload.note ?? "").trim().slice(0, 1e3);
  if (spec.note && !note) fail("Please write a short note.");
  const req = JSON.parse(JSON.stringify(prev));
  let to = spec.to ?? req.status;
  let eventNote = note;
  switch (action) {
    case "start_offer": {
      const opt = payload.option !== void 0 ? payload.option : req.recommendation.recommended;
      if (opt && !req.recommendation.options.some((o) => o.code === opt)) fail("Pick one of the AI options.");
      req.offer = offerFromOption(req, opt, settings, actor.name, now);
      if (!req.assignee) req.assignee = { id: actor.id, name: actor.name };
      eventNote = opt ? `Started from the "${req.recommendation.options.find((o) => o.code === opt).label}" option.` : "Started a blank offer.";
      break;
    }
    case "save_offer": {
      if (!req.offer) fail("Start the offer first.");
      const lines = (payload.lines ?? req.offer.lines).map((l, i) => {
        const label = String(l.label ?? "").trim();
        if (!label) fail(`Line ${i + 1} needs a name.`);
        if (!Number.isFinite(l.cost) || !Number.isFinite(l.price)) fail(`Line ${i + 1}: cost and price must be numbers.`);
        return { id: l.id || `l${i + 1}`, kind: l.kind || "other", label: label.slice(0, 120), detail: String(l.detail ?? "").slice(0, 300), cost: Math.round(l.cost), price: Math.round(l.price) };
      });
      const discount = Math.round(payload.discount ?? req.offer.discount);
      if (discount < 0) fail("The discount can't be negative.");
      const option = payload.option !== void 0 ? payload.option : req.offer.option;
      req.offer = { option, lines, discount, notes: (payload.notes ?? req.offer.notes).slice(0, 1e3), version: req.offer.version + 1, updated_by: actor.name, updated_at: now, totals: null };
      req.offer.totals = totals(req, req.offer, settings);
      if (prev.status === "approved" || prev.status === "sent") {
        guardSubmit(req);
        to = "pending_approval";
        req.approval = null;
        req.submitted_by = { id: actor.id, name: actor.name };
        eventNote = `Offer changed after approval (now ${peso(req.offer.totals.price)}), so it goes back for approval.${note ? " " + note : ""}`;
      } else eventNote = `Offer saved: ${peso(req.offer.totals.price)}.${note ? " " + note : ""}`;
      break;
    }
    case "submit": {
      guardSubmit(req);
      req.submitted_by = { id: actor.id, name: actor.name };
      eventNote = `Sent for approval at ${peso(req.offer.totals.price)} (margin ${req.offer.totals.margin_pct}%).${note ? " " + note : ""}`;
      break;
    }
    case "approve": {
      const t = req.offer.totals;
      if (req.submitted_by?.id === actor.id) fail("You prepared this offer, so someone else must approve it.");
      if (t.below_cost) fail(`This offer is ${peso(t.cost - t.price)} below cost. Ask for changes instead.`);
      if (t.low_margin && !note) fail(`The margin is only ${t.margin_pct}% (the minimum is ${settings.min_margin_pct}%). Write the reason for approving it.`);
      req.approval = { by: actor.name, by_id: actor.id, at: now, note, version: req.offer.version, valid_until: addDays(now, settings.validity_days) };
      eventNote = `Approved at ${peso(t.price)}. Valid until ${fmtDay(req.approval.valid_until.slice(0, 10))}.${note ? " " + note : ""}`;
      break;
    }
    case "send":
      if (isExpired(req, now)) fail("This offer has expired. Recheck the rates and edit the offer so it can be approved again.");
      eventNote = note || "Quotation sent to the customer.";
      break;
    case "customer_accept":
      if (isExpired(req, now)) fail("This offer has expired. Please ask us to recheck the rates.");
      if (!req.approval || req.approval.version !== req.offer?.version) fail("This offer is being updated. Please check again later.");
      eventNote = note || "Customer accepted the offer.";
      break;
    case "customer_changes":
      req.customer_question = null;
      break;
    case "customer_question":
      req.customer_question = { text: note, at: now };
      break;
    case "answer":
      if (!req.customer_question) fail("There is no open question from the customer.");
      req.customer_question = null;
      break;
    case "customer_feedback": {
      if (req.feedback) fail("Thank you! You already rated this trip.");
      const rating = Math.round(Number(payload.rating));
      if (!(rating >= 1 && rating <= 5)) fail("Please choose 1 to 5 stars.");
      req.feedback = { rating, text: note, at: now };
      eventNote = `${rating} of 5 stars.${note ? " " + note : ""}`;
      break;
    }
    case "assign": {
      const a = payload.assignee ?? fail("Choose a salesperson.");
      if (actor.role === "SALES" && a.id !== actor.id) fail("Salespeople can only take a request for themselves.");
      req.assignee = { id: a.id, name: a.name };
      eventNote = `Assigned to ${a.name}.`;
      break;
    }
    case "mark_lost": {
      const r = payload.reason ?? "";
      if (!LOST_REASONS[r]) fail("Choose why the request was lost.");
      req.lost_reason = r;
      eventNote = LOST_REASONS[r] + (note ? `. ${note}` : "");
      break;
    }
    default:
      break;
  }
  req.status = to;
  req.updated_at = now;
  req.events.push({ at: now, by: actor.name, role: actor.role, action, from: prev.status, to, note: eventNote });
  return req;
}
function guardSubmit(req) {
  const o = req.offer ?? fail("Start the offer first.");
  if (!o.lines.length || o.totals.price <= 0) fail("Add at least one priced line before sending for approval.");
  if (o.totals.below_cost) fail(`The offer is ${peso(o.totals.cost - o.totals.price)} below cost. Raise the price or lower the discount first.`);
}
function quotationTerms(req, settings, now) {
  const o = req.offer, a = req.approval;
  const deposit = r100(o.totals.price * settings.deposit_pct / 100);
  const d = destByCode(req.input.destination);
  let balance_due = `${settings.balance_days_before} days before departure`;
  if (req.input.travel_date) {
    const due = new Date(Date.parse(req.input.travel_date) - settings.balance_days_before * 864e5).toISOString().slice(0, 10);
    balance_due = `on or before ${fmtDay(due < now.slice(0, 10) ? now.slice(0, 10) : due)}`;
  }
  const kinds = new Set(o.lines.map((l) => l.kind));
  const exclusions = ["Meals not stated in the itinerary", "Personal expenses, tips and shopping", "Excess baggage and seat selection", "Anything not listed under inclusions"];
  if (!kinds.has("visa") && d?.visa.needed) exclusions.unshift("Visa fees (visa assistance can be added)");
  if (!kinds.has("insurance") && !o.lines.some((l) => l.label.toLowerCase().includes("insurance"))) exclusions.unshift("Travel insurance (recommended)");
  return {
    ref: req.ref,
    issued: a.at,
    valid_until: a.valid_until,
    expired: isExpired(req, now),
    deposit,
    balance: o.totals.price - deposit,
    balance_due,
    inclusions: o.lines.filter((l) => l.kind !== "fee" && l.price >= 0).map((l) => `${l.label}: ${l.detail}`),
    exclusions,
    cancellation: [
      `A ${settings.deposit_pct}% deposit confirms the booking. Flights and hotels are booked only after the deposit.`,
      "Deposits become non-refundable once tickets and hotels are issued; changes follow airline and hotel rules.",
      "If a visa is refused, refunds follow airline and hotel rules minus fees already paid.",
      "Sample terms: PAPH Travel and Tours will replace these with its official policy."
    ],
    checklist: d ? d.visa.docs : [],
    visa_note: d ? `${d.visa.label}. ${d.visa.note} Always check the latest requirements before you apply.` : ""
  };
}

// src/quote/history.ts
function rng(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var HOUR = 36e5;
var FEEDBACK_WEIGHTS = [3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1];
var LOST_WEIGHTS = [["price", 40], ["dates", 20], ["other_agency", 15], ["no_response", 20], ["plans_changed", 5]];
function generateHistory(now, people, firstSeq, settings) {
  const r = rng(sample_history_default.seed);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  const pickW = (xs) => {
    let x = r() * xs.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of xs) {
      x -= w;
      if (x < 0) return v;
    }
    return xs[xs.length - 1][0];
  };
  const end = +new Date(now);
  const out = [];
  for (let i = 0; i < sample_history_default.count; i++) {
    const ageDays = sample_history_default.days - i * (sample_history_default.days - 14) / sample_history_default.count;
    let t = end - ageDays * 24 * HOUR - Math.floor(r() * 10) * HOUR;
    const at = () => new Date(t).toISOString();
    const text = pick(sample_history_default.requests), customer = pick(sample_history_default.customers);
    const fast = r() < 0.58;
    const sales = fast ? people.sales[0] : people.sales[1], agent = people.agent;
    let req = createRequest({ id: `hist-${i + 1}`, seq: firstSeq + i, now: at(), customer: { name: customer, contact: `0917 555 ${2e3 + i}` }, raw_text: text, input: parseRequest(text, at()), addons: [], is_sample: true }, settings);
    const cust = { id: "customer", name: req.customer.name, role: "CUSTOMER" };
    const step = (hours, action, who, payload = {}) => {
      t += hours * HOUR;
      req = apply(req, action, who, payload, at(), settings);
    };
    const outcome = r();
    step(fast ? 1 + r() * 4 : 6 + r() * 22, "start_offer", sales);
    if (r() < 0.3) {
      step(2, "customer_question", cust, { note: pick(sample_history_default.questions) });
      step(fast ? 1 : 9, "answer", sales, { note: "Answered by phone." });
    }
    if (r() < 0.5) step(0.5, "save_offer", sales, { discount: Math.floor(req.offer.totals.margin * r() * 0.5 / 100) * 100 });
    step(1, "submit", sales);
    if (outcome >= 0.88) {
      step(5, "decline", agent, { note: "Partner hotels are full on those dates. Offer another month." });
      out.push(req);
      continue;
    }
    if (r() < 0.2) {
      step(4, "request_changes", agent, { note: "Please use a lower hotel level to fit their budget." });
      step(3, "save_offer", sales, { discount: 0 });
      step(0.5, "submit", sales);
    }
    step(4, "approve", agent, req.offer.totals.low_margin ? { note: "Repeat customer, small margin is okay." } : {});
    step(1, "send", sales);
    if (outcome < 0.5) {
      if (r() < 0.25) step(10, "customer_question", cust, { note: pick(sample_history_default.questions) }), step(fast ? 1 : 12, "answer", sales, { note: "Replied with the details." });
      step(20, "customer_accept", cust);
      step(30, "mark_booked", sales);
      const tripEnd = t + (14 + req.input.days) * 24 * HOUR;
      if (tripEnd + 48 * HOUR < end && r() < 0.8) {
        const idx = pickW(FEEDBACK_WEIGHTS.map((w, k) => [k, w]));
        const [rating, note] = sample_history_default.feedback[idx];
        t = tripEnd + 48 * HOUR;
        req = apply(req, "customer_feedback", cust, { rating, note }, at(), settings);
      }
    } else {
      if (r() < 0.35) step(18, "customer_changes", cust, { note: pick(sample_history_default.changes) });
      const reason = pickW(LOST_WEIGHTS);
      step(48, "mark_lost", sales, { reason, note: pick(sample_history_default.lost_notes[reason]) });
    }
    out.push(req);
  }
  return out;
}

// src/sentiment/lexicon.json
var lexicon_default = {
  version: "1.0",
  positive: {
    maganda: 2,
    ganda: 2,
    napakaganda: 3,
    magaling: 2,
    galing: 2,
    "ang galing": 2.5,
    salamat: 1.5,
    "salamat po": 1.5,
    "maraming salamat": 2,
    "thank you": 1.5,
    thanks: 1.5,
    ty: 1,
    excellent: 3,
    great: 2,
    good: 1.5,
    "very good": 2.5,
    okay: 0.5,
    ok: 0.5,
    "okay naman": 0.6,
    ayos: 1.5,
    maayos: 1.5,
    mabait: 2,
    mababait: 2,
    mabilis: 2,
    fast: 2,
    quick: 1.5,
    friendly: 2,
    love: 2.5,
    loved: 2.5,
    satisfied: 2,
    happy: 2,
    masaya: 2,
    sulit: 2,
    "worth it": 2,
    recommend: 2,
    "highly recommend": 3,
    recommended: 2,
    solid: 2,
    helpful: 2,
    clean: 1.5,
    malinis: 1.5,
    professional: 2,
    amazing: 3,
    awesome: 2.5,
    best: 2.5,
    perfect: 3,
    nice: 1.5,
    accommodating: 2,
    approachable: 2,
    efficient: 2,
    smooth: 1.5,
    impressed: 2.5,
    relaxing: 2,
    comfortable: 1.5,
    komportable: 1.5,
    affordable: 1.5,
    mura: 1,
    legit: 1.5,
    "the best": 3,
    babalik: 1.5,
    "babalik ako": 2,
    "will come back": 2,
    glad: 1.5,
    pleased: 2,
    wonderful: 2.5,
    fantastic: 3,
    superb: 3,
    outstanding: 3,
    "on time": 1.5,
    maasikaso: 2,
    magalang: 2,
    polite: 2,
    kind: 1.5,
    caring: 2,
    effective: 2,
    "effective naman": 2,
    gumanda: 2,
    "nag glow": 2,
    glowing: 1.5,
    worth: 1.5,
    appreciate: 2,
    appreciated: 2,
    "sana all": 0
  },
  negative: {
    bagal: -2,
    mabagal: -2,
    napakabagal: -3,
    slow: -2,
    tagal: -2,
    matagal: -2,
    "sobrang tagal": -3,
    "ang tagal": -2.5,
    pangit: -2.5,
    panget: -2.5,
    bad: -2,
    "very bad": -3,
    worst: -3,
    terrible: -3,
    rude: -2.5,
    bastos: -3,
    disappointing: -2.5,
    disappointed: -2.5,
    disappointment: -2.5,
    nakakadismaya: -2.5,
    dismayado: -2.5,
    sayang: -1.5,
    mahal: -1,
    expensive: -1.5,
    overpriced: -2,
    dirty: -2,
    madumi: -2,
    marumi: -2,
    problem: -1.5,
    problema: -1.5,
    issue: -1,
    complaint: -1.5,
    reklamo: -1.5,
    "walang sumasagot": -2.5,
    "walang sumagot": -2.5,
    "no response": -2.5,
    "no reply": -2.5,
    "not responding": -2.5,
    "hindi sumasagot": -2.5,
    "di sumasagot": -2.5,
    ignored: -2,
    "seen lang": -2,
    scam: -3,
    palpak: -2.5,
    sablay: -2,
    nakakainis: -2.5,
    inis: -2,
    galit: -2.5,
    angry: -2.5,
    frustrating: -2.5,
    frustrated: -2.5,
    hassle: -2,
    abala: -1.5,
    masakit: -1.5,
    allergic: -2,
    rash: -2,
    pantal: -2,
    infection: -2.5,
    error: -1.5,
    cancelled: -1.5,
    "never again": -3,
    "di na babalik": -3,
    "hindi na babalik": -3,
    unprofessional: -2.5,
    late: -1.5,
    delay: -2,
    delayed: -2,
    waste: -2,
    "sayang oras": -2.5,
    broken: -2,
    sira: -2,
    poor: -2,
    unhappy: -2,
    awful: -3,
    horrible: -3,
    "pa more": -1.5,
    nakakabwisit: -3,
    bwisit: -2.5,
    kawawa: -1.5,
    "hindi okay": -2,
    "di okay": -2,
    "not okay": -2,
    useless: -2.5,
    "walang kwenta": -3,
    lugi: -2,
    ripoff: -2.5,
    "rip off": -2.5,
    mess: -1.5,
    gulo: -1.5,
    magulo: -1.5,
    confusing: -1.5,
    naghintay: -1,
    waited: -1,
    pinaghintay: -2,
    "hanggang ngayon": -1.5,
    "wala pa rin": -2,
    "still waiting": -2,
    unresolved: -2,
    "not resolved": -2,
    "hindi pa rin": -1.5,
    namaga: -2.5,
    swelling: -2,
    "side effect": -2,
    "side effects": -2,
    stranded: -3,
    naiwan: -2,
    naaksidente: -3,
    aksidente: -2.5,
    accident: -2.5,
    sugat: -2,
    "may sugat": -2.5,
    nagsusuka: -2.5,
    injured: -2.5,
    nilalagnat: -2.5,
    "may lagnat": -2.5,
    offloaded: -2.5,
    "na-offload": -2.5,
    "food poisoning": -3,
    nawala: -2,
    lost: -2,
    delayed: -1.5,
    masikip: -1.5,
    unsafe: -2.5,
    rushed: -1.5,
    mabaho: -2,
    "smelled bad": -2
  },
  negators: ["hindi", "di", "not", "no", "never", "wala", "walang", "isnt", "wasnt", "dont", "didnt", "doesnt", "hnd", "d", "nope", "aint"],
  intensifiers: {
    sobrang: 1.6,
    sobra: 1.5,
    super: 1.5,
    very: 1.4,
    grabe: 1.5,
    napaka: 1.6,
    really: 1.3,
    so: 1.3,
    extremely: 1.8,
    too: 1.3,
    talaga: 1.3,
    totally: 1.4,
    absolutely: 1.5,
    sooo: 1.5,
    soooo: 1.6,
    ubod: 1.6
  },
  contrast: ["pero", "but", "kaso", "however", "kaya lang", "kaya lng", "although", "though", "kahit", "yet"],
  emotions: {
    happiness: ["happy", "masaya", "saya", "yay", "love", "loved", "glad", "natuwa", "tuwang tuwa", "kilig"],
    satisfaction: ["satisfied", "sulit", "worth it", "ayos", "maayos", "okay naman", "good", "solid", "effective", "pleased", "maganda ang resulta"],
    appreciation: ["thank you", "thanks", "salamat", "appreciate", "appreciated", "grateful", "ty"],
    anger: ["galit", "angry", "bastos", "rude", "nakakabwisit", "bwisit", "scam", "furious", "pissed", "walang respeto", "demanda"],
    frustration: ["tagal", "matagal", "bagal", "mabagal", "naghintay", "waited", "pinaghintay", "wala pa rin", "still waiting", "frustrating", "frustrated", "hassle", "nakakainis", "inis", "hanggang ngayon", "seen lang", "no response", "walang sumasagot", "hours", "oras na"],
    disappointment: ["disappointing", "disappointed", "nakakadismaya", "dismayado", "sayang", "expected more", "akala ko", "not worth", "di sulit", "hindi sulit", "pangit", "panget"],
    sadness: ["sad", "malungkot", "lungkot", "nakakaiyak", "iyak", "heartbroken", "kawawa"],
    confusion: ["confused", "confusing", "naguguluhan", "hindi ko maintindihan", "di ko gets", "paano po", "bakit po", "unclear", "magulo"],
    concern: ["worried", "nag-aalala", "nag aalala", "concerned", "safe ba", "safe po ba", "side effect", "allergic", "pantal", "namaga", "masakit", "is it safe", "kinakabahan", "safe for", "pregnant", "buntis", "breastfeeding", "nagpapadede", "stranded", "naiwan", "nawala", "lost passport", "nilalagnat", "unsafe", "wheelchair", "kailangan po ba ng visa"],
    excitement: ["excited", "can't wait", "cant wait", "excited na", "sabik", "wow", "omg", "grabe ang ganda"]
  },
  intents: {
    follow_up_request: ["follow up", "follow-up", "any update", "update po", "ano na po", "wala pa rin", "still waiting", "until now", "hanggang ngayon", "nag message na ako", "i already messaged", "naka ilang message"],
    request_assistance: ["paki", "pakitulong", "pakiusap", "please help", "help me", "tulungan", "tulong", "assist", "please call", "contact me", "pa assist", "pa-assist", "need help", "patulong"],
    reported_problem: ["error", "hindi gumagana", "di gumagana", "not working", "doesnt work", "sira", "bug", "cant book", "hindi ma book", "di ma book", "failed", "nag error", "allergic", "pantal", "namaga", "side effect", "charged twice", "double charge", "nawala", "stranded", "naiwan", "sira ang aircon", "mali ang spelling", "food poisoning"],
    suggestion: ["sana", "suggest", "suggestion", "mas maganda kung", "it would be better", "dapat", "should", "pls add", "please add", "sana may", "recommend na", "hope you", "sana mag"],
    inquiry: ["pwede po ba", "pwede po bang", "pwede ba", "magkano", "how much", "saan", "where", "kailan", "when", "paano", "how do", "how can", "ano po", "what", "available", "open ba", "open po ba", "may slot", "is there", "do you", "may tanong", "magtanong", "inquire", "inquiry", "price list"],
    appreciation: ["thank you", "thanks", "salamat", "appreciate", "grateful"],
    compliment: ["galing", "magaling", "ganda", "maganda", "excellent", "great", "amazing", "best", "love", "highly recommend", "mabait", "friendly", "professional"]
  },
  topics: {
    "Response Time": ["response", "reply", "replies", "sumasagot", "sumagot", "sagot", "respond", "responding", "seen", "message", "messages", "inquiry", "chat", "landline", "natatawagan"],
    "Waiting Time & Delays": ["wait", "waited", "waiting", "naghintay", "hintay", "pila", "queue", "hours", "oras", "minutes", "late", "delay", "delayed", "tagal"],
    "Tour Guides & Staff": ["staff", "tour guide", "guide", "guides", "driver", "travel agent", "agent", "coordinator", "trip leader", "booking officer", "mabait", "rude", "bastos", "friendly", "accommodating", "maasikaso", "magalang", "polite", "patient"],
    "Tours & Itinerary": ["tour", "tours", "itinerary", "trip", "island hopping", "stops", "service", "serbisyo", "experience", "organized", "rushed", "biyahe"],
    "Pricing & Promos": ["price", "presyo", "mahal", "expensive", "magkano", "promo", "seat sale", "discount", "sulit", "cheap", "mura", "overpriced", "package", "rate", "installment"],
    "Hotels & Accommodation": ["hotel", "resort", "room", "accommodation", "check-in", "check in", "aircon", "breakfast", "beach", "views", "smelled", "mabaho"],
    "Booking & Reservations": ["book", "booking", "reservation", "schedule", "sched", "slot", "slots", "reschedule", "cancelled", "cancel", "confirmation", "fully booked", "e-ticket", "ticket"],
    "Flights & Transfers": ["flight", "flights", "airport", "transfer", "transfers", "pickup", "pick up", "sundo", "van", "bus", "boat", "bangka", "ferry", "meeting point"],
    "Visa & Travel Documents": ["visa", "passport", "documents", "requirements", "embassy", "offload", "offloaded", "immigration", "travel insurance", "insurance"],
    "Safety & Health": ["accident", "naaksidente", "aksidente", "injured", "nasugatan", "sugat", "nagsusuka", "food poisoning", "nilalagnat", "lagnat", "fever", "nahilo", "dizzy", "seasick", "unsafe", "stranded", "naiwan", "lost passport", "nawala passport", "nawala po passport", "nawala ang passport", "doctor", "hospital", "ospital"],
    "Payment & Refunds": ["refund", "payment", "gcash", "charged", "charge", "bayad", "receipt", "resibo", "card", "credit card"],
    Destinations: ["destination", "boracay", "el nido", "coron", "palawan", "bohol", "siargao", "cebu", "japan", "seoul", "korea", "hong kong", "taiwan", "vietnam", "bali", "island"],
    "Online Experience": ["website", "site", "app", "link", "page", "online", "form", "payment page"]
  },
  critical_terms: [
    "accident",
    "naaksidente",
    "aksidente",
    "injured",
    "nasugatan",
    "hospital",
    "ospital",
    "emergency",
    "nahimatay",
    "fainted",
    "bleeding",
    "dumugo",
    "lawyer",
    "abogado",
    "demanda",
    "sue",
    "legal action",
    "police",
    "pulis",
    "scam",
    "fraud",
    "data leak",
    "privacy",
    "harassment",
    "hinipuan",
    "can't breathe",
    "cant breathe",
    "hirap huminga",
    "lagnat",
    "nilalagnat",
    "fever",
    "nahilo",
    "dizzy",
    "food poisoning",
    "stranded",
    "naiwan po kami",
    "naiwan kami",
    "lost passport",
    "nawala po passport",
    "nawala passport",
    "nawala ang passport",
    "unsafe",
    "missing",
    "nawawala"
  ],
  sarcasm_praise: ["wow", "galing", "ang galing", "excellent", "great", "nice", "perfect", "thanks a lot", "salamat ha", "amazing", "best", "super", "congrats", "bravo", "fantastic", "galing talaga"],
  sarcasm_negative_markers: ["waited", "naghintay", "pinaghintay", "hours", "oras", "minutes", "pa more", "seen lang", "walang sumasagot", "no response", "wala pa rin", "still waiting", "hanggang ngayon", "nawala", "lost", "late", "cancelled", "sira", "palpak", "charged twice"],
  question_starters: ["pwede", "magkano", "saan", "kailan", "paano", "ano", "may", "how", "what", "where", "when", "is", "are", "do", "does", "can", "could", "available", "open"]
};

// src/sentiment/engine.ts
var L = lexicon_default;
var ENGINE_VERSION = `rule-engine-1.0 (lexicon ${L.version})`;
var TIME_RE = /\b(\d+|one|two|three|four|five|six|isang|dalawang|tatlong)\s*(hours?|hrs?|oras|minutes?|mins?|days?|araw|weeks?|linggo)\b/g;
function normalize2(text) {
  let t = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  t = t.replace(/https?:\/\/\S+/g, " ").replace(/'/g, "");
  t = t.replace(/[^a-z0-9ñ?!\s-]/g, " ").replace(/-/g, " ");
  return t.replace(/\s+/g, " ").trim();
}
function findAll(padded, term) {
  const out = [];
  const needle = ` ${term} `;
  let i = 0;
  for (; ; ) {
    i = padded.indexOf(needle, i);
    if (i < 0) return out;
    out.push(i + 1);
    i += 1;
  }
}
var contains = (padded, term) => padded.includes(` ${term} `);
var hits = (padded, words) => words.filter((w) => contains(padded, w));
function detectLanguage(norm) {
  const fil = /* @__PURE__ */ new Set(["ang", "ng", "po", "naman", "pero", "sobrang", "hindi", "di", "ba", "mga", "sa", "na", "ko", "ako", "kayo", "nyo", "lang", "talaga", "sana", "kasi"]);
  const en = /* @__PURE__ */ new Set(["the", "is", "and", "but", "very", "not", "was", "i", "you", "it", "to", "for", "my", "service", "please"]);
  const words = norm.replace(/[?!]/g, " ").split(" ").filter(Boolean);
  const f = words.filter((w) => fil.has(w)).length, e = words.filter((w) => en.has(w)).length;
  return f && e ? "taglish" : f ? "filipino" : e ? "english" : "unknown";
}
function scoreTerms(norm, contrastAt) {
  const padded = ` ${norm.replace(/[?!]/g, " ")} `;
  const terms = [...Object.entries(L.positive), ...Object.entries(L.negative)];
  terms.sort((a, b) => b[0].length - a[0].length);
  const negators = new Set(L.negators);
  const matches = [];
  for (const [term, weight] of terms) {
    if (weight === 0) continue;
    for (const start of findAll(padded, term)) {
      const end = start + term.length;
      if (matches.some(([s, e]) => s < end && start < e)) continue;
      matches.push([start, end, term, weight]);
    }
  }
  matches.sort((a, b) => a[0] - b[0]);
  const signals = [];
  let prevEnd = 0;
  for (const [start, end, term, weight] of matches) {
    const before = padded.slice(prevEnd, start).split(" ").filter(Boolean).slice(-3);
    prevEnd = end;
    let w = weight;
    const notes = [];
    const selfNeg = ["wala", "walang", "hindi", "di ", "no ", "not ", "never"].some((p) => term.startsWith(p));
    if (before.some((b) => negators.has(b)) && !selfNeg) {
      w = -w * 0.8;
      notes.push("negated");
    }
    const mult = Math.max(1, ...before.slice(-2).map((b) => L.intensifiers[b] ?? 1));
    if (mult > 1) {
      w *= mult;
      notes.push("intensified");
    }
    if (contrastAt !== null) {
      if (start < contrastAt) {
        w *= 0.4;
        notes.push("before contrast");
      } else {
        w *= 1.4;
        notes.push("after contrast");
      }
    }
    signals.push({ term, weight: Math.round(w * 100) / 100, note: notes.join(", ") });
  }
  return signals;
}
function contrastPosition(norm) {
  const padded = ` ${norm} `;
  let best = null, word = null;
  for (const c of L.contrast) for (const pos of findAll(padded, c)) if (pos > 2 && (best === null || pos > best)) {
    best = pos;
    word = c;
  }
  return [best, word];
}
function analyze(text, rating = null, th = { negative_max: -25, positive_min: 25 }) {
  const norm = normalize2(text);
  const padded = ` ${norm.replace(/\?/g, " ? ").replace(/!/g, " ! ")} `;
  const [contrastAt, contrastWord] = contrastPosition(norm);
  const signals = scoreTerms(norm, contrastAt);
  let raw = signals.reduce((s, x) => s + x.weight, 0);
  if (text.includes("!") && raw) raw *= 1.1;
  const praise = hits(padded, L.sarcasm_praise);
  const negMarkers = [...hits(padded, L.sarcasm_negative_markers), ...Array.from(norm.matchAll(TIME_RE)).map((m) => m[0])];
  const sarcasm = praise.length > 0 && negMarkers.length > 0 && raw > -1.5;
  let score2 = 100 * Math.tanh(raw / 4);
  if (rating !== null && rating !== void 0) {
    const rs = (rating - 3) / 2 * 80;
    score2 = signals.length ? 0.5 * score2 + 0.5 * rs : rs;
  }
  if (sarcasm) score2 = Math.min(-40, -Math.abs(score2));
  const scoreI = Math.round(Math.max(-100, Math.min(100, score2)));
  const label = scoreI <= th.negative_max ? "negative" : scoreI >= th.positive_min ? "positive" : "neutral";
  const emoClause = contrastAt !== null ? ` ${norm.slice(contrastAt)} ` : padded;
  const emo = {};
  for (const [e, words] of Object.entries(L.emotions)) emo[e] = hits(padded, words).length + (contrastAt !== null ? hits(emoClause, words).length : 0);
  if (sarcasm) emo.frustration += 2;
  if (text.includes("?") && ["paano", "bakit", "how", "why"].some((w) => contains(padded, w))) emo.confusion += 1;
  const negE = ["anger", "frustration", "disappointment", "sadness", "concern"], posE = ["happiness", "satisfaction", "appreciation", "excitement"];
  const pool = label === "negative" ? [...negE, "confusion"] : label === "positive" ? posE : Object.keys(emo);
  const argmax = (keys) => keys.reduce((a2, b) => (emo[b] ?? 0) > (emo[a2] ?? 0) ? b : a2, keys[0]);
  let best = argmax(pool);
  if ((emo[best] ?? 0) === 0) best = argmax(Object.keys(emo));
  if ((emo[best] ?? 0) === 0) best = label === "positive" ? "satisfaction" : label === "negative" ? "disappointment" : "neutral";
  else if (label === "positive" && ["frustration", "anger", "disappointment", "sadness"].includes(best) && !sarcasm) best = "satisfaction";
  else if (label === "negative" && posE.includes(best)) best = sarcasm || negMarkers.length ? "frustration" : "disappointment";
  const ih = {};
  for (const [k, v] of Object.entries(L.intents)) ih[k] = hits(padded, v);
  const firstWord = norm.split(" ")[0] ?? "";
  const isQuestion = text.includes("?") || L.question_starters.includes(firstWord) && norm.split(" ").length <= 12;
  let intent, why;
  if (ih.follow_up_request.length) [intent, why] = ["follow_up_request", `asks for an update ('${ih.follow_up_request[0]}')`];
  else if (ih.request_assistance.length) [intent, why] = ["request_assistance", `asks for help ('${ih.request_assistance[0]}')`];
  else if (ih.reported_problem.length) [intent, why] = ["reported_problem", `reports a problem ('${ih.reported_problem[0]}')`];
  else if (label === "negative") [intent, why] = ["complaint", "expresses dissatisfaction"];
  else if (isQuestion || ih.inquiry.length && label === "neutral") [intent, why] = ["inquiry", "asks a question" + (ih.inquiry.length ? ` ('${ih.inquiry[0]}')` : "")];
  else if (ih.suggestion.length) [intent, why] = ["suggestion", `proposes an improvement ('${ih.suggestion[0]}')`];
  else if (label === "positive" && ih.appreciation.length) [intent, why] = ["appreciation", `thanks the business ('${ih.appreciation[0]}')`];
  else if (label === "positive") [intent, why] = ["compliment", "praises the service"];
  else [intent, why] = ["general_feedback", "shares an opinion without a request"];
  const th2 = {};
  const main = contrastAt !== null ? ` ${norm.slice(contrastAt)} ` : padded;
  for (const [topic, words] of Object.entries(L.topics)) {
    const n = hits(padded, words).length;
    if (n) th2[topic] = n + 2 * hits(main, words).length;
  }
  if (th2["Safety & Health"]) th2["Safety & Health"] += 10;
  const sortedTopics = Object.keys(th2).sort((a2, b) => th2[b] - th2[a2]);
  const topics = sortedTopics.length ? sortedTopics : ["General"];
  const signs = new Set(signals.map((s) => s.weight > 0 ? 1 : -1));
  let conf = 0.55 + Math.min(0.3, 0.06 * signals.length);
  if (signs.size === 1) conf += 0.08;
  else if (signs.size > 1 && contrastAt === null) conf -= 0.18;
  if (rating !== null && rating !== void 0) conf += 0.07;
  if (!signals.length) conf = intent === "inquiry" ? 0.72 : 0.5;
  if (sarcasm) conf = Math.min(conf, 0.6);
  conf = Math.round(Math.max(0.3, Math.min(0.97, conf)) * 100) / 100;
  const a = {
    label,
    score: scoreI,
    confidence: conf,
    emotion: best,
    emotion_scores: emo,
    intent,
    intent_reason: `The message ${why}.`,
    topics: topics.slice(0, 3),
    primary_topic: topics[0],
    possible_sarcasm: sarcasm,
    reason: explain(label, scoreI, signals, contrastWord, sarcasm, praise, negMarkers, rating),
    priority: "low",
    priority_reason: "",
    recommended_action: "",
    language: detectLanguage(norm),
    engine: "rule",
    model_version: ENGINE_VERSION
  };
  return a;
}
function explain(label, score2, signals, contrastWord, sarcasm, praise, neg, rating) {
  if (sarcasm) return `Possible sarcasm: positive wording (${praise.slice(0, 2).map((p) => `'${p}'`).join(", ")}) contradicts a negative experience (${neg.slice(0, 2).map((m) => `'${m}'`).join(", ")}). Treated as negative and sent for manual review.`;
  if (!signals.length) return "No clear positive or negative wording was found, so the message is treated as neutral." + (rating ? ` The ${rating}-star rating was used.` : "");
  const pos = signals.filter((s) => s.weight > 0), negs = signals.filter((s) => s.weight < 0);
  const fmt = (items) => [...items].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 3).map((s) => `'${s.term}'` + (s.note ? ` (${s.note})` : "")).join(", ");
  const parts = [];
  if (contrastWord && pos.length && negs.length) {
    const after = signals.filter((s) => s.note.includes("after contrast")).reduce((t, s) => t + s.weight, 0);
    parts.push(`The message changes direction at '${contrastWord}'; the part after it is ${after < 0 ? "negative" : "positive"} and carries more weight.`);
  }
  if (negs.length) parts.push(`Negative cues: ${fmt(negs)}.`);
  if (pos.length) parts.push(`Positive cues: ${fmt(pos)}.`);
  if (rating) parts.push(`Star rating ${rating}/5 was combined with the text.`);
  parts.push(`Overall score ${score2 >= 0 ? "+" : ""}${score2} \u2192 ${label}.`);
  return parts.join(" ");
}
var TOPICS = [...Object.keys(L.topics), "General"];

// src/quote/owner.ts
var THEME_LABEL = {
  "Response Time": "Slow replies",
  "Waiting Time & Delays": "Delays and waiting",
  "Tour Guides & Staff": "Staff and guides",
  "Tours & Itinerary": "Tours and itinerary",
  "Pricing & Promos": "Price",
  "Hotels & Accommodation": "Hotels",
  "Booking & Reservations": "Booking",
  "Flights & Transfers": "Flights and transfers",
  "Visa & Travel Documents": "Visa and documents",
  "Safety & Health": "Safety and health",
  "Payment & Refunds": "Payments and refunds",
  Destinations: "The destination",
  "Online Experience": "Website and messages",
  General: "General"
};
var KIND_LABEL = { request: "Trip request", question: "Question on the offer", changes: "Asked for changes", feedback: "After-trip review", lost: "Why they left (staff note)" };
var MONTHS2 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var DAY = 864e5;
var round12 = (x) => Math.floor(x * 10 + 0.5) / 10;
var pct = (a, b) => b ? round12(a / b * 100) : null;
var avg = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
var cache = /* @__PURE__ */ new Map();
function moodOf(text, rating = null) {
  const key = `${rating ?? ""}|${text}`;
  let v = cache.get(key);
  if (!v) {
    const a = analyze(text, rating);
    v = { mood: a.label, score: a.score, theme: a.primary_topic };
    cache.set(key, v);
  }
  return v;
}
function rangeStart(range, now) {
  if (range === "all") return null;
  if (range === "year") return `${now.slice(0, 4)}-01-01T00:00:00.000Z`;
  return new Date(+new Date(now) - Number(range) * DAY).toISOString();
}
var bookedAt = (r) => [...r.events].reverse().find((e) => e.action === "mark_booked")?.at ?? null;
var has = (r, action) => r.events.some((e) => e.action === action);
function voicesOf(r) {
  const d = destByCode(r.input.destination);
  const base = { request_id: r.id, ref: r.ref, customer: r.customer.name, destination: d?.code ?? "other", destination_name: d?.name ?? r.input.place_text ?? "Other places", salesperson: r.assignee?.name ?? "Unassigned", status: r.status, is_sample: r.is_sample };
  const out = [];
  const push = (kind, at, text, rating = null) => {
    if (!text.trim()) return;
    const m = moodOf(text, rating);
    out.push({ ...base, kind, kind_label: KIND_LABEL[kind], at, text, rating, mood: m.mood, score: m.score, theme: m.theme, theme_label: THEME_LABEL[m.theme] ?? m.theme });
  };
  if (r.raw_text) push("request", r.created_at, r.raw_text);
  for (const e of r.events) {
    if (e.action === "customer_question") push("question", e.at, e.note);
    if (e.action === "customer_changes") push("changes", e.at, e.note);
    if (e.action === "mark_lost") push("lost", e.at, e.note);
  }
  if (r.feedback) push("feedback", r.feedback.at, r.feedback.text || `${r.feedback.rating} of 5 stars`, r.feedback.rating);
  return out;
}
function slice(key, label, vs) {
  const c = (m) => vs.filter((v) => v.mood === m).length;
  return { key, label, count: vs.length, positive: c("positive"), neutral: c("neutral"), negative: c("negative"), score: Math.round(avg(vs.map((v) => v.score)) ?? 0) };
}
function groupBy(xs, key) {
  const m = /* @__PURE__ */ new Map();
  for (const x of xs) {
    const k = key(x);
    m.set(k, [...m.get(k) ?? [], x]);
  }
  return m;
}
var mondayOf = (iso) => {
  const d = /* @__PURE__ */ new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
};
var monthLabel = (ym) => `${MONTHS2[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
function ownerReport(all, f, now) {
  const from = rangeStart(f.range, now);
  const scoped = all.filter((r) => (!f.destination || (r.input.destination ?? "other") === f.destination) && (!f.salesperson || r.assignee?.id === f.salesperson));
  const reqs = scoped.filter((r) => !from || r.created_at >= from);
  const voices = scoped.flatMap(voicesOf).filter((v) => !from || v.at >= from).sort((a, b) => b.at.localeCompare(a.at));
  const total = voices.length, positive = voices.filter((v) => v.mood === "positive").length, negative = voices.filter((v) => v.mood === "negative").length;
  const weekly = f.range === "30";
  const trend = [...groupBy(voices, (v) => weekly ? mondayOf(v.at) : v.at.slice(0, 7)).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, vs]) => ({ ...slice(k, weekly ? `Week of ${MONTHS2[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8, 10))}` : monthLabel(k), vs), period: k }));
  const slices = (key, label) => [...groupBy(voices, key).entries()].map(([k, vs]) => slice(k, label(vs[0]), vs)).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const themeVoices = voices.filter((v) => v.kind !== "request" || v.mood !== "neutral");
  const themes = [...groupBy(themeVoices.filter((v) => v.theme !== "General"), (v) => v.theme).entries()].map(([k, vs]) => ({
    theme: k,
    label: THEME_LABEL[k] ?? k,
    count: vs.length,
    positive: vs.filter((v) => v.mood === "positive").length,
    negative: vs.filter((v) => v.mood === "negative").length,
    requests: new Set(vs.filter((v) => v.mood === "negative").map((v) => v.request_id)).size,
    examples: [...vs].sort((a, b) => (a.mood === "negative" ? 0 : 1) - (b.mood === "negative" ? 0 : 1) || b.at.localeCompare(a.at)).slice(0, 3)
  })).sort((a, b) => b.negative - a.negative || b.count - a.count || a.label.localeCompare(b.label));
  const rated = voices.filter((v) => v.kind === "feedback" && v.rating);
  const stars = [1, 2, 3, 4, 5].map((n) => rated.filter((v) => v.rating === n).length);
  const byPerson = groupBy(reqs.filter((r) => r.assignee), (r) => r.assignee.id);
  const team = [...byPerson.entries()].map(([id, rs]) => {
    const resp = rs.map((r) => {
      const e = r.events.find((x) => x.role === "SALES" || x.role === "ADMIN" || x.role === "AGENT");
      return e ? (+new Date(e.at) - +new Date(r.created_at)) / 36e5 : null;
    }).filter((x) => x !== null);
    const decided = rs.filter((r) => has(r, "approve") || has(r, "request_changes") || has(r, "decline"));
    const approved = rs.filter((r) => has(r, "approve"));
    const booked2 = rs.filter((r) => r.status === "booked");
    const vs = voices.filter((v) => rs.some((r) => r.id === v.request_id));
    const margins = approved.filter((r) => r.offer).map((r) => r.offer.totals.margin_pct);
    return {
      id,
      name: rs[0].assignee.name,
      handled: rs.length,
      avg_response_hours: resp.length ? round12(avg(resp)) : null,
      offers_sent: rs.filter((r) => has(r, "submit")).length,
      approval_rate: pct(approved.length, decided.length),
      booking_rate: pct(booked2.length, approved.length),
      revenue: booked2.reduce((s, r) => s + (r.offer?.totals.price ?? 0), 0),
      avg_margin_pct: margins.length ? round12(avg(margins)) : null,
      sentiment_score: vs.length ? Math.round(avg(vs.map((v) => v.score))) : null,
      voices: vs.length
    };
  }).sort((a, b) => b.revenue - a.revenue || b.handled - a.handled);
  const bookedReqs = scoped.filter((r) => r.status === "booked" && r.offer && (!from || (bookedAt(r) ?? "") >= from));
  const booked = bookedReqs.reduce((s, r) => s + r.offer.totals.price, 0), margin = bookedReqs.reduce((s, r) => s + r.offer.totals.margin, 0);
  const pipelineReqs = reqs.filter((r) => ["approved", "sent", "accepted", "pending_approval"].includes(r.status) && r.offer);
  const by_month = [...groupBy(bookedReqs, (r) => bookedAt(r).slice(0, 7)).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, rs]) => ({ period: k, label: monthLabel(k), revenue: rs.reduce((s, r) => s + r.offer.totals.price, 0), margin: rs.reduce((s, r) => s + r.offer.totals.margin, 0), bookings: rs.length }));
  const by_destination = [...groupBy(bookedReqs, (r) => r.input.destination ?? "other").entries()].map(([k, rs]) => ({ key: k, label: destByCode(k)?.name ?? "Other places", revenue: rs.reduce((s, r) => s + r.offer.totals.price, 0), margin: rs.reduce((s, r) => s + r.offer.totals.margin, 0), bookings: rs.length })).sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));
  const funnel = [
    { step: "requests", label: "Requests received", count: reqs.length },
    { step: "drafted", label: "Offer prepared", count: reqs.filter((r) => has(r, "start_offer")).length },
    { step: "submitted", label: "Sent for approval", count: reqs.filter((r) => has(r, "submit")).length },
    { step: "approved", label: "Approved and quoted", count: reqs.filter((r) => has(r, "approve")).length },
    { step: "accepted", label: "Customer accepted", count: reqs.filter((r) => has(r, "customer_accept")).length },
    { step: "booked", label: "Booked", count: reqs.filter((r) => r.status === "booked").length }
  ];
  const lost = groupBy(reqs.filter((r) => r.status === "lost" && r.lost_reason), (r) => r.lost_reason);
  const lost_reasons = [...lost.entries()].map(([k, rs]) => ({ reason: k, label: LOST_REASONS[k] ?? k, count: rs.length })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const report = {
    filters: f,
    period: { from, to: now },
    sample_count: reqs.filter((r) => r.is_sample).length,
    requests: reqs.length,
    briefing: { verdict: "", bullets: [] },
    sentiment: {
      total,
      positive,
      neutral: total - positive - negative,
      negative,
      positive_pct: pct(positive, total) ?? 0,
      negative_pct: pct(negative, total) ?? 0,
      avg_score: Math.round(avg(voices.map((v) => v.score)) ?? 0),
      trend,
      by_destination: slices((v) => v.destination, (v) => v.destination_name),
      by_salesperson: slices((v) => v.salesperson, (v) => v.salesperson),
      by_stage: slices((v) => v.status, (v) => STATUSES[v.status].staff),
      themes,
      attention: voices.filter((v) => v.mood === "negative" && v.kind !== "lost").slice(0, 12),
      ratings: { avg: rated.length ? round12(avg(rated.map((v) => v.rating))) : null, count: rated.length, stars }
    },
    team,
    revenue: {
      booked,
      bookings: bookedReqs.length,
      margin,
      margin_pct: pct(margin, booked),
      pipeline: pipelineReqs.reduce((s, r) => s + r.offer.totals.price, 0),
      pipeline_count: pipelineReqs.length,
      avg_booking: bookedReqs.length ? Math.floor(booked / bookedReqs.length / 100 + 0.5) * 100 : null,
      quote_to_book_pct: pct(funnel[5].count, funnel[3].count),
      by_month,
      by_destination,
      funnel,
      lost_reasons
    },
    voices,
    options: {
      destinations: [...new Map(all.map((r) => [r.input.destination ?? "other", destByCode(r.input.destination)?.name ?? "Other places"])).entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
      salespeople: [...new Map(all.filter((r) => r.assignee).map((r) => [r.assignee.id, r.assignee.name])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
    }
  };
  report.briefing = briefing(scoped, report, now);
  return report;
}
function briefing(scoped, rep, now) {
  const t = +new Date(now);
  const inWin = (r, a, b) => {
    const at = bookedAt(r);
    return !!at && r.status === "booked" && +new Date(at) > t - a * DAY && +new Date(at) <= t - b * DAY;
  };
  const cur = scoped.filter((r) => inWin(r, 30, 0)), prev = scoped.filter((r) => inWin(r, 60, 30));
  const sum = (rs) => rs.reduce((s2, r) => s2 + (r.offer?.totals.price ?? 0), 0);
  const bullets = [];
  if (prev.length && cur.length) {
    const ch = Math.round((sum(cur) - sum(prev)) / sum(prev) * 100);
    bullets.push(`Bookings ${ch >= 0 ? "up" : "down"} ${Math.abs(ch)}% in the last 30 days: ${peso(sum(cur))} from ${cur.length} trip${cur.length > 1 ? "s" : ""}.`);
  } else bullets.push(cur.length ? `${cur.length} trip${cur.length > 1 ? "s" : ""} booked in the last 30 days (${peso(sum(cur))}).` : "No trips booked in the last 30 days yet.");
  const top = [...groupBy(scoped.filter((r) => +new Date(r.created_at) > t - 90 * DAY), (r) => destByCode(r.input.destination)?.name ?? "Other places").entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (top.length) bullets.push(top.length > 1 ? `${top[0][0]} and ${top[1][0]} lead customer requests this quarter.` : `${top[0][0]} leads customer requests this quarter.`);
  const worst = rep.sentiment.themes.find((x) => x.negative > 0);
  if (worst) bullets.push(`Customers are unhappy about ${worst.label.toLowerCase()} on ${worst.requests} request${worst.requests > 1 ? "s" : ""}.`);
  const waiting = scoped.filter((r) => hoursWaiting(r, now) >= 24).length, pending = scoped.filter((r) => r.status === "pending_approval").length;
  if (waiting || pending) bullets.push([waiting ? `${waiting} request${waiting > 1 ? "s have" : " has"} waited over 24 hours` : "", pending ? `${pending} offer${pending > 1 ? "s wait" : " waits"} for approval` : ""].filter(Boolean).join("; ") + ".");
  const s = rep.sentiment;
  const verdict = !s.total ? "Not enough customer messages yet to read the mood." : s.negative_pct >= 30 ? `Customers are mostly unhappy right now${worst ? `, mainly about ${worst.label.toLowerCase()}` : ""}. Fix that first.` : s.positive_pct >= 50 ? `Customers are happy (${s.positive_pct}% positive)${worst ? `; keep an eye on ${worst.label.toLowerCase()}` : ""}.` : `Customer mood is steady (${s.positive_pct}% positive, ${s.negative_pct}% negative)${worst ? `; the main complaint is ${worst.label.toLowerCase()}` : ""}.`;
  return { verdict, bullets: bullets.slice(0, 4) };
}
function voicesCsv(vs) {
  const esc = (x) => {
    const s = String(x ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Date", "Reference", "Customer", "Destination", "Salesperson", "Stage", "Type", "Message", "Mood", "Score", "Theme", "Stars", "Sample"];
  return [head, ...vs.map((v) => [v.at.slice(0, 10), v.ref, v.customer, v.destination_name, v.salesperson, STATUSES[v.status].staff, v.kind_label, v.text, v.mood, v.score, v.theme_label, v.rating ?? "", v.is_sample ? "yes" : ""])].map((row) => row.map(esc).join(",")).join("\r\n");
}
export {
  ACTIONS,
  DEFAULT_SETTINGS,
  FlowError,
  LOST_REASONS,
  ROLE_LABELS,
  STATUSES,
  THEME_LABEL,
  allowed,
  apply,
  createRequest,
  generateHistory,
  hoursWaiting,
  isExpired,
  moodOf,
  offerFromOption,
  ownerReport,
  quotationTerms,
  rangeStart,
  refFor,
  rng,
  rulesFrom,
  totals,
  voicesCsv,
  voicesOf
};
