// src/lib/keralaTrains.ts

export const KERALA_TRAINS = [
  { id: '16347', name: 'Trivandrum Express', rakeIdPrefix: 'Rake 1', route: 'Trivandrum - Mangalore' },
  { id: '16629', name: 'Malabar Express', rakeIdPrefix: 'Rake 2', route: 'Trivandrum - Mangalore' },
  { id: '12076', name: 'Jan Shatabdi', rakeIdPrefix: 'Rake 3', route: 'Trivandrum - Kozhikode' },
  { id: '16307', name: 'Executive Express', rakeIdPrefix: 'Rake 4', route: 'Alleppey - Kannur' },
  { id: '16341', name: 'Intercity Express', rakeIdPrefix: 'Rake 5', route: 'Trivandrum - Guruvayur' },
  { id: '20634', name: 'Vande Bharat', rakeIdPrefix: 'Rake 6', route: 'Trivandrum - Kasaragod' },
  { id: '16327', name: 'Pune Express', rakeIdPrefix: 'Rake 7', route: 'Ernakulam - Pune' },
  { id: '16791', name: 'Palaruvi Express', rakeIdPrefix: 'Rake 8', route: 'Punalur - Palakkad' },
  { id: '16343', name: 'Amritha Express', rakeIdPrefix: 'Rake 9', route: 'Trivandrum - Madurai' },
  { id: '12643', name: 'Nizamuddin Express', rakeIdPrefix: 'Rake 10', route: 'Trivandrum - Nizamuddin' },
  { id: '16315', name: 'Kochuveli Express', rakeIdPrefix: 'Rake 11', route: 'Mysore - Kochuveli' },
  { id: '16302', name: 'Venad Express', rakeIdPrefix: 'Rake 12', route: 'Trivandrum - Shoranur' },
  { id: '16605', name: 'Ernad Express', rakeIdPrefix: 'Rake 13', route: 'Mangalore - Nagercoil' },
  { id: '22628', name: 'Tiruchchirappalli Exp', rakeIdPrefix: 'Rake 14', route: 'Trivandrum - Trichy' },
  { id: '16349', name: 'Rajya Rani Express', rakeIdPrefix: 'Rake 15', route: 'Kochuveli - Nilambur' },
];

export const getKeralaTrainDetails = (rakeId: string) => {
  // Normalize Rake-01 to Rake 1 for matching
  const normalizedId = rakeId.replace('-', ' ');
  
  // Try to find a specific mapping
  const found = KERALA_TRAINS.find(t => normalizedId.includes(t.rakeIdPrefix));
  if (found) return found;

  // Handle RS- prefix but with different routes
  if (rakeId.includes('RS-101')) return { id: '90101', name: 'Aluva Fast Passenger', route: 'Aluva - Ernakulam' };
  if (rakeId.includes('RS-102')) return { id: '90102', name: 'Kochi Metro Liner', route: 'Aluva - Petta' };
  if (rakeId.includes('RS-103')) return { id: '90103', name: 'Malabar Shuttle', route: 'Kozhikode - Kannur' };

  // Fallback if we add more rakes
  return {
    id: '99999',
    name: 'Kerala Local Passenger',
    route: 'Ernakulam - Thrissur'
  };
};

export const KERALA_STATIONS_ROUTES = [
  {
    id: 'TRV-ERS',
    stations: [
      { id: 'TVC', name: 'Thiruvananthapuram Central', distance: 0, arrivalTime: '05:15', departureTime: '05:15' },
      { id: 'VAK', name: 'Varkala Sivagiri', distance: 41, arrivalTime: '05:40', departureTime: '05:41' },
      { id: 'QLN', name: 'Kollam Junction', distance: 65, arrivalTime: '06:08', departureTime: '06:10' },
      { id: 'KYJ', name: 'Kayamkulam Junction', distance: 106, arrivalTime: '06:33', departureTime: '06:35' },
      { id: 'CNGR', name: 'Chengannur', distance: 126, arrivalTime: '06:53', departureTime: '06:55' },
      { id: 'TRVL', name: 'Tiruvalla', distance: 135, arrivalTime: '07:04', departureTime: '07:05' },
      { id: 'KTYM', name: 'Kottayam', distance: 161, arrivalTime: '07:27', departureTime: '07:30' },
      { id: 'ERS', name: 'Ernakulam Town', distance: 221, arrivalTime: '08:25', departureTime: '08:25' }
    ]
  },
  {
    id: 'ERS-CLT',
    stations: [
      { id: 'ERS', name: 'Ernakulam Junction', distance: 0, arrivalTime: '17:50', departureTime: '17:50' },
      { id: 'AWY', name: 'Aluva', distance: 19, arrivalTime: '18:13', departureTime: '18:15' },
      { id: 'TCR', name: 'Thrissur', distance: 74, arrivalTime: '19:03', departureTime: '19:05' },
      { id: 'SRR', name: 'Shoranur Junction', distance: 107, arrivalTime: '19:52', departureTime: '19:55' },
      { id: 'TIR', name: 'Tirur', distance: 152, arrivalTime: '20:34', departureTime: '20:35' },
      { id: 'CLT', name: 'Kozhikode Main', distance: 193, arrivalTime: '21:27', departureTime: '21:27' }
    ]
  }
];

export const getRouteForTrain = (trainName: string) => {
  // Alternate between the two routes for demo purposes, or based on name
  if (trainName.length % 2 === 0) {
    return KERALA_STATIONS_ROUTES[0];
  }
  return KERALA_STATIONS_ROUTES[1];
};
