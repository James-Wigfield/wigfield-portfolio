// ── Party Imposter — content libraries ────────────────────────────────────────
// Designed for high replay value. Each mode has its own data shape:
//   • CLASSIC_CATEGORIES → { category: [word, ...] }
//   • SIMILAR_PAIRS      → { category: [[crewWord, imposterWord], ...] }
//   • QUESTION_PAIRS     → [{ category, crew, imposter }, ...]
//   • CHAMELEON_GRIDS    → [{ category, words: [...16] }, ...]

// ── 1. CLASSIC: everyone sees the word, imposter sees nothing ────────────────
export const CLASSIC_CATEGORIES = {
  Animals: [
    'Tiger', 'Elephant', 'Dolphin', 'Penguin', 'Giraffe', 'Cheetah', 'Octopus', 'Kangaroo',
    'Koala', 'Panda', 'Owl', 'Eagle', 'Shark', 'Whale', 'Crocodile', 'Lion',
    'Zebra', 'Rhino', 'Hippo', 'Gorilla', 'Sloth', 'Flamingo', 'Peacock', 'Camel',
    'Otter', 'Hedgehog', 'Raccoon', 'Squirrel', 'Bat', 'Fox', 'Wolf', 'Bear',
    'Moose', 'Llama', 'Donkey', 'Horse', 'Pig', 'Sheep', 'Goat', 'Rabbit',
    'Hamster', 'Snake', 'Tortoise', 'Frog', 'Lizard', 'Platypus', 'Walrus', 'Seal',
    'Jellyfish', 'Stingray',
  ],
  Food: [
    'Pizza', 'Sushi', 'Burger', 'Taco', 'Croissant', 'Lasagna', 'Pasta', 'Steak',
    'Salad', 'Sandwich', 'Pancake', 'Waffle', 'Donut', 'Cupcake', 'Brownie', 'Cheesecake',
    'Ice Cream', 'Pretzel', 'Bagel', 'Toast', 'Curry', 'Ramen', 'Dumpling', 'Pho',
    'Risotto', 'Paella', 'Burrito', 'Quesadilla', 'Fajita', 'Nachos', 'Hot Dog', 'Bacon',
    'Cereal', 'Omelette', 'Smoothie', 'Milkshake', 'Coffee', 'Espresso', 'Latte', 'Tea',
    'Champagne', 'Whiskey', 'Beer', 'Wine', 'Cocktail', 'Lemonade', 'Sashimi', 'Falafel',
    'Hummus', 'Guacamole',
  ],
  Places: [
    'Beach', 'Mountain', 'Library', 'Museum', 'Airport', 'Hospital', 'Castle', 'Church',
    'School', 'Park', 'Zoo', 'Aquarium', 'Stadium', 'Theatre', 'Cinema', 'Mall',
    'Restaurant', 'Cafe', 'Hotel', 'Bank', 'Pharmacy', 'Gym', 'Office', 'Farm',
    'Vineyard', 'Lighthouse', 'Cathedral', 'Mosque', 'Temple', 'Casino', 'Arcade', 'Spa',
    'Salon', 'Garden', 'Forest', 'Desert', 'Cave', 'Glacier', 'Volcano', 'Waterfall',
    'Island', 'Pier', 'Harbor', 'Bridge', 'Tower', 'Pyramid', 'Stonehenge', 'Petra',
    'Eiffel Tower', 'Times Square',
  ],
  Movies: [
    'Inception', 'Titanic', 'Avatar', 'Star Wars', 'The Matrix', 'Jurassic Park', 'Shrek', 'Frozen',
    'Toy Story', 'Finding Nemo', 'Forrest Gump', 'Gladiator', 'Pulp Fiction', 'Goodfellas', 'The Godfather', 'Casablanca',
    'Rocky', 'Jaws', 'E.T.', 'Back to the Future', 'Ghostbusters', 'Indiana Jones', 'Lord of the Rings', 'Harry Potter',
    'The Dark Knight', 'Spider-Man', 'Iron Man', 'Black Panther', 'Avengers', 'Joker', 'Deadpool', 'Logan',
    'La La Land', 'Whiplash', 'Inside Out', 'Up', 'WALL-E', 'Moana', 'Encanto', 'Coco',
    'The Lion King', 'Aladdin', 'Mulan', 'Tangled', 'The Notebook', 'Dirty Dancing', 'Grease', 'Sound of Music',
  ],
  Sports: [
    'Basketball', 'Tennis', 'Golf', 'Surfing', 'Skiing', 'Snowboarding', 'Soccer', 'Football',
    'Baseball', 'Hockey', 'Cricket', 'Rugby', 'Volleyball', 'Badminton', 'Boxing', 'Wrestling',
    'Karate', 'Judo', 'Fencing', 'Archery', 'Swimming', 'Diving', 'Rowing', 'Sailing',
    'Cycling', 'Marathon', 'Sprinting', 'Pole Vault', 'Gymnastics', 'Skateboarding', 'BMX', 'Climbing',
    'Bowling', 'Curling', 'Polo', 'Rodeo', 'Sumo', 'Lacrosse', 'Squash', 'Darts',
  ],
  Objects: [
    'Hammer', 'Umbrella', 'Calendar', 'Mirror', 'Candle', 'Pillow', 'Blanket', 'Telescope',
    'Microscope', 'Globe', 'Compass', 'Map', 'Backpack', 'Suitcase', 'Wallet', 'Keychain',
    'Sunglasses', 'Watch', 'Bracelet', 'Necklace', 'Ring', 'Earring', 'Hat', 'Scarf',
    'Gloves', 'Boots', 'Sneakers', 'Helmet', 'Bicycle', 'Skateboard', 'Surfboard', 'Tent',
    'Sleeping Bag', 'Fishing Rod', 'Binoculars', 'Lantern', 'Toolbox', 'Wrench', 'Drill', 'Saw',
    'Vacuum', 'Toaster', 'Kettle', 'Blender', 'Microwave', 'Refrigerator', 'Toilet', 'Bathtub',
  ],
  Professions: [
    'Doctor', 'Teacher', 'Chef', 'Astronaut', 'Firefighter', 'Police Officer', 'Lawyer', 'Engineer',
    'Architect', 'Dentist', 'Veterinarian', 'Nurse', 'Pharmacist', 'Accountant', 'Banker', 'Realtor',
    'Plumber', 'Electrician', 'Carpenter', 'Mechanic', 'Pilot', 'Sailor', 'Soldier', 'Spy',
    'Detective', 'Judge', 'Mayor', 'President', 'Scientist', 'Inventor', 'Programmer', 'Designer',
    'Photographer', 'Journalist', 'Author', 'Poet', 'Actor', 'Director', 'Singer', 'DJ',
    'Magician', 'Clown', 'Acrobat', 'Bartender', 'Barista', 'Waiter', 'Florist', 'Tailor',
  ],
  Music: [
    'Guitar', 'Drums', 'Piano', 'Microphone', 'Violin', 'Saxophone', 'Trumpet', 'Flute',
    'Bass', 'Harp', 'Accordion', 'Banjo', 'Ukulele', 'Harmonica', 'Tambourine', 'Cymbals',
    'Concert', 'Festival', 'Orchestra', 'Choir', 'Band', 'DJ Set', 'Karaoke', 'Opera',
    'Rock', 'Jazz', 'Hip Hop', 'Country', 'Reggae', 'Punk', 'Metal', 'Blues',
    'Beatles', 'Queen', 'Beyoncé', 'Drake', 'Taylor Swift', 'Eminem', 'Madonna', 'Elvis',
  ],
  Tech: [
    'Smartphone', 'Laptop', 'Tablet', 'Smartwatch', 'Headphones', 'Earbuds', 'Speaker', 'Camera',
    'Drone', 'Router', 'Printer', 'Scanner', 'Keyboard', 'Mouse', 'Monitor', 'Webcam',
    'VR Headset', 'Game Console', 'Controller', 'USB Drive', 'Hard Drive', 'SSD', 'GPU', 'CPU',
    'Wi-Fi', 'Bluetooth', 'AI', 'Blockchain', 'NFT', 'Hologram', 'Robot', 'Algorithm',
    'Google', 'Apple', 'Microsoft', 'Tesla', 'TikTok', 'Instagram', 'YouTube', 'Discord',
  ],
  Nature: [
    'Volcano', 'Glacier', 'Desert', 'Rainforest', 'Tornado', 'Hurricane', 'Earthquake', 'Tsunami',
    'Aurora', 'Rainbow', 'Lightning', 'Thunder', 'Blizzard', 'Avalanche', 'Eclipse', 'Comet',
    'Meteor', 'Galaxy', 'Black Hole', 'Supernova', 'Coral Reef', 'Canyon', 'Geyser', 'Iceberg',
    'Oak Tree', 'Bamboo', 'Cactus', 'Sunflower', 'Rose', 'Tulip', 'Orchid', 'Lavender',
    'Moss', 'Vines', 'Mushroom', 'Lily', 'Daisy', 'Maple', 'Pine', 'Cherry Blossom',
  ],
  Mythology: [
    'Zeus', 'Athena', 'Poseidon', 'Hades', 'Apollo', 'Artemis', 'Hermes', 'Ares',
    'Thor', 'Loki', 'Odin', 'Freya', 'Anubis', 'Ra', 'Isis', 'Horus',
    'Dragon', 'Phoenix', 'Unicorn', 'Pegasus', 'Mermaid', 'Centaur', 'Minotaur', 'Cyclops',
    'Hydra', 'Kraken', 'Werewolf', 'Vampire', 'Ghost', 'Witch', 'Wizard', 'Fairy',
    'Goblin', 'Elf', 'Dwarf', 'Troll', 'Yeti', 'Bigfoot', 'Loch Ness', 'Chupacabra',
  ],
  TV: [
    'Breaking Bad', 'Game of Thrones', 'Stranger Things', 'The Office', 'Friends', 'Seinfeld', 'Lost', 'Dexter',
    'Sopranos', 'The Wire', 'Mad Men', 'Better Call Saul', 'Westworld', 'Severance', 'Succession', 'Euphoria',
    'House of Cards', 'Black Mirror', 'Mr. Robot', 'Sherlock', 'Doctor Who', 'Peaky Blinders', 'The Crown', 'Bridgerton',
    'Squid Game', 'Money Heist', 'Narcos', 'Ozark', 'True Detective', 'Fargo', 'The Mandalorian', 'WandaVision',
    'SpongeBob', 'Family Guy', 'South Park', 'The Simpsons', 'Avatar Airbender', 'Rick and Morty', 'BoJack Horseman', 'Arcane',
  ],
  VideoGames: [
    'Minecraft', 'Fortnite', 'Roblox', 'GTA V', 'Call of Duty', 'Valorant', 'League of Legends', 'CS2',
    'Overwatch', 'Apex Legends', 'PUBG', 'Among Us', 'Fall Guys', 'Rocket League', 'FIFA', 'NBA 2K',
    'Mario', 'Zelda', 'Pokémon', 'Sonic', 'Pac-Man', 'Tetris', 'Doom', 'Halo',
    'Elden Ring', 'Dark Souls', 'Witcher 3', 'Skyrim', 'Fallout', 'Cyberpunk 2077', 'Red Dead', 'Last of Us',
    'God of War', 'Uncharted', 'Resident Evil', 'Silent Hill', 'Bioshock', 'Portal', 'Half-Life', 'Stardew Valley',
  ],
  Disney: [
    'Mickey Mouse', 'Donald Duck', 'Goofy', 'Pluto', 'Minnie Mouse', 'Daisy Duck', 'Scrooge McDuck', 'Pinocchio',
    'Bambi', 'Dumbo', 'Cinderella', 'Snow White', 'Sleeping Beauty', 'Belle', 'Ariel', 'Jasmine',
    'Mulan', 'Pocahontas', 'Rapunzel', 'Tiana', 'Moana', 'Elsa', 'Anna', 'Olaf',
    'Simba', 'Mufasa', 'Scar', 'Timon', 'Pumbaa', 'Stitch', 'Genie', 'Maleficent',
    'Buzz Lightyear', 'Woody', 'Sully', 'Mike Wazowski', 'Nemo', 'Dory', 'Lightning McQueen', 'Mater',
  ],
  Body: [
    'Heart', 'Brain', 'Eyes', 'Ears', 'Nose', 'Lips', 'Tongue', 'Teeth',
    'Hair', 'Beard', 'Eyebrows', 'Eyelashes', 'Cheeks', 'Chin', 'Neck', 'Shoulders',
    'Arms', 'Elbows', 'Wrists', 'Hands', 'Fingers', 'Nails', 'Chest', 'Stomach',
    'Back', 'Hips', 'Knees', 'Ankles', 'Feet', 'Toes', 'Lungs', 'Kidneys',
    'Liver', 'Spine', 'Skull', 'Ribs',
  ],
  History: [
    'Roman Empire', 'Ancient Egypt', 'Greek Empire', 'Aztecs', 'Mayans', 'Vikings', 'Samurai', 'Knights',
    'Pirates', 'Cowboys', 'Renaissance', 'Industrial Revolution', 'World War I', 'World War II', 'Cold War', 'Moon Landing',
    'Berlin Wall', 'Titanic', 'Pearl Harbor', 'Hiroshima', 'D-Day', 'French Revolution', 'American Revolution', 'Civil War',
    'Pyramids', 'Great Wall', 'Colosseum', 'Mona Lisa', 'Sistine Chapel', 'Magna Carta', 'Declaration of Independence', 'Constitution',
  ],
  // 18+ — unlocked only when ADULTS MODE is on in setup.
  Adults: [
    'One Night Stand', 'Threesome', 'Quickie', 'Booty Call', 'Sexting', 'Friends With Benefits',
    'Dirty Talk', 'Foreplay', 'Afterglow', 'Hickey', 'Lap Dance', 'Strip Club',
    'Lingerie', 'Sex Toy', 'Vibrator', 'Handcuffs', 'Roleplay', 'Safe Word',
    'Kink', 'Fetish', 'Climax', 'Morning Sex', 'Shower Sex', 'Birthday Sex',
    'Ghosting', 'Catfish', 'Walk of Shame', 'Drunk Text', 'Sliding Into DMs',
    'Tinder Date', 'Hinge Match', 'Hookup', 'Situationship', 'Sugar Daddy', 'Sugar Baby',
    'Open Relationship', 'Polyamory', 'Swingers', 'Wingman', 'Rebound',
    'Morning Wood', 'Pregnancy Scare', 'Plan B', 'Condom Mishap',
    'Blackout Drunk', 'Bar Crawl', 'Beer Goggles', 'Tequila Shots',
    'Bachelor Party', 'Bachelorette Party', 'Strip Poker', 'Body Shot',
  ],
};

// ── 2. MIRROR: crew sees word A, imposter sees similar word B ────────────────
// Pairs are designed to be close enough to bluff but distinct enough that careful
// questions ("name a feature", "what color") will eventually expose the imposter.
export const SIMILAR_PAIRS = {
  Animals: [
    ['Cat', 'Dog'], ['Lion', 'Tiger'], ['Wolf', 'Fox'], ['Crocodile', 'Alligator'],
    ['Frog', 'Toad'], ['Rabbit', 'Hare'], ['Eagle', 'Hawk'], ['Owl', 'Crow'],
    ['Shark', 'Dolphin'], ['Whale', 'Orca'], ['Cow', 'Buffalo'], ['Horse', 'Donkey'],
    ['Sheep', 'Goat'], ['Hamster', 'Guinea Pig'], ['Crab', 'Lobster'], ['Octopus', 'Squid'],
    ['Penguin', 'Puffin'], ['Tortoise', 'Turtle'], ['Snake', 'Lizard'], ['Cheetah', 'Leopard'],
    ['Panther', 'Jaguar'], ['Mouse', 'Rat'], ['Bee', 'Wasp'], ['Butterfly', 'Moth'],
  ],
  Food: [
    ['Pizza', 'Lasagna'], ['Burger', 'Hot Dog'], ['Sushi', 'Sashimi'], ['Taco', 'Burrito'],
    ['Pancake', 'Waffle'], ['Donut', 'Bagel'], ['Cake', 'Pie'], ['Cookie', 'Brownie'],
    ['Ice Cream', 'Gelato'], ['Tea', 'Coffee'], ['Latte', 'Cappuccino'], ['Beer', 'Wine'],
    ['Whiskey', 'Bourbon'], ['Pasta', 'Noodles'], ['Steak', 'Pork Chop'], ['Bacon', 'Sausage'],
    ['Curry', 'Stew'], ['Ramen', 'Pho'], ['Cheesecake', 'Tiramisu'], ['Smoothie', 'Milkshake'],
    ['Croissant', 'Danish'], ['Falafel', 'Meatball'], ['Hummus', 'Guacamole'], ['Toast', 'Crumpet'],
  ],
  Places: [
    ['Beach', 'Lake'], ['Mountain', 'Hill'], ['Forest', 'Jungle'], ['Desert', 'Canyon'],
    ['Library', 'Bookstore'], ['Museum', 'Gallery'], ['Hotel', 'Motel'], ['Cinema', 'Theatre'],
    ['Cafe', 'Diner'], ['Bank', 'Post Office'], ['Park', 'Garden'], ['Castle', 'Palace'],
    ['Church', 'Cathedral'], ['Mosque', 'Temple'], ['Stadium', 'Arena'], ['Mall', 'Market'],
    ['Pharmacy', 'Hospital'], ['Gym', 'Spa'], ['Airport', 'Train Station'], ['Pier', 'Harbor'],
    ['Cave', 'Tunnel'], ['Vineyard', 'Orchard'], ['Lighthouse', 'Watchtower'], ['Island', 'Peninsula'],
  ],
  Movies: [
    ['Titanic', 'Avatar'], ['Star Wars', 'Star Trek'], ['Inception', 'The Matrix'], ['Avengers', 'Justice League'],
    ['Iron Man', 'Batman'], ['Spider-Man', 'Daredevil'], ['Frozen', 'Tangled'], ['Toy Story', 'Cars'],
    ['Finding Nemo', 'Moana'], ['Shrek', 'Madagascar'], ['Harry Potter', 'Percy Jackson'], ['Lord of the Rings', 'Hobbit'],
    ['Jaws', 'Anaconda'], ['Jurassic Park', 'Godzilla'], ['Rocky', 'Creed'], ['Gladiator', 'Braveheart'],
    ['La La Land', 'Whiplash'], ['Forrest Gump', 'Cast Away'], ['Joker', 'Deadpool'], ['Coco', 'Encanto'],
  ],
  Sports: [
    ['Soccer', 'Football'], ['Basketball', 'Netball'], ['Tennis', 'Badminton'], ['Baseball', 'Cricket'],
    ['Hockey', 'Lacrosse'], ['Swimming', 'Diving'], ['Skiing', 'Snowboarding'], ['Surfing', 'Bodyboarding'],
    ['Boxing', 'MMA'], ['Karate', 'Judo'], ['Wrestling', 'Sumo'], ['Cycling', 'BMX'],
    ['Marathon', 'Triathlon'], ['Golf', 'Mini Golf'], ['Bowling', 'Curling'], ['Volleyball', 'Beach Volleyball'],
    ['Rugby', 'Aussie Rules'], ['Polo', 'Croquet'], ['Climbing', 'Bouldering'], ['Skateboarding', 'Rollerblading'],
  ],
  Objects: [
    ['Hammer', 'Wrench'], ['Saw', 'Drill'], ['Pen', 'Pencil'], ['Phone', 'Tablet'],
    ['Laptop', 'Desktop'], ['Couch', 'Loveseat'], ['Chair', 'Stool'], ['Lamp', 'Candle'],
    ['Pillow', 'Cushion'], ['Blanket', 'Quilt'], ['Mirror', 'Picture Frame'], ['Watch', 'Bracelet'],
    ['Ring', 'Earring'], ['Hat', 'Beanie'], ['Sunglasses', 'Goggles'], ['Backpack', 'Tote Bag'],
    ['Suitcase', 'Duffel Bag'], ['Umbrella', 'Raincoat'], ['Toaster', 'Microwave'], ['Vacuum', 'Broom'],
  ],
  Music: [
    ['Guitar', 'Bass'], ['Violin', 'Cello'], ['Piano', 'Keyboard'], ['Trumpet', 'Trombone'],
    ['Flute', 'Clarinet'], ['Drums', 'Bongos'], ['Saxophone', 'Oboe'], ['Banjo', 'Ukulele'],
    ['Concert', 'Festival'], ['Choir', 'Orchestra'], ['Rock', 'Metal'], ['Jazz', 'Blues'],
    ['Hip Hop', 'Rap'], ['Pop', 'R&B'], ['Country', 'Folk'], ['Reggae', 'Ska'],
    ['Beatles', 'Rolling Stones'], ['Drake', 'Kendrick'], ['Beyoncé', 'Rihanna'], ['Taylor Swift', 'Olivia Rodrigo'],
  ],
  Tech: [
    ['iPhone', 'Android'], ['Mac', 'PC'], ['Wi-Fi', 'Bluetooth'], ['TikTok', 'Instagram'],
    ['YouTube', 'Twitch'], ['Discord', 'Slack'], ['Google', 'Bing'], ['Tesla', 'Rivian'],
    ['Headphones', 'Earbuds'], ['Mouse', 'Trackpad'], ['Keyboard', 'Touchscreen'], ['VR', 'AR'],
    ['Drone', 'Helicopter'], ['Printer', 'Scanner'], ['Hard Drive', 'SSD'], ['GPU', 'CPU'],
    ['Robot', 'Android'], ['AI', 'Algorithm'], ['Camera', 'Camcorder'], ['Smartwatch', 'Fitness Tracker'],
  ],
  Nature: [
    ['Volcano', 'Geyser'], ['Glacier', 'Iceberg'], ['Hurricane', 'Tornado'], ['Tsunami', 'Flood'],
    ['Lightning', 'Thunder'], ['Rainbow', 'Aurora'], ['Comet', 'Meteor'], ['Star', 'Planet'],
    ['Sun', 'Moon'], ['Oak', 'Maple'], ['Pine', 'Spruce'], ['Cactus', 'Aloe'],
    ['Rose', 'Tulip'], ['Daisy', 'Sunflower'], ['Orchid', 'Lily'], ['Moss', 'Lichen'],
    ['Mushroom', 'Fern'], ['Coral Reef', 'Kelp Forest'], ['Canyon', 'Gorge'], ['Avalanche', 'Landslide'],
  ],
  Mythology: [
    ['Zeus', 'Thor'], ['Hades', 'Anubis'], ['Apollo', 'Ra'], ['Athena', 'Freya'],
    ['Dragon', 'Wyvern'], ['Vampire', 'Werewolf'], ['Witch', 'Wizard'], ['Elf', 'Dwarf'],
    ['Goblin', 'Troll'], ['Phoenix', 'Griffin'], ['Unicorn', 'Pegasus'], ['Mermaid', 'Siren'],
    ['Centaur', 'Minotaur'], ['Cyclops', 'Giant'], ['Hydra', 'Kraken'], ['Yeti', 'Bigfoot'],
    ['Ghost', 'Poltergeist'], ['Fairy', 'Pixie'], ['Demon', 'Devil'], ['Angel', 'Cherub'],
  ],
  TV: [
    ['Breaking Bad', 'Better Call Saul'], ['Game of Thrones', 'House of the Dragon'], ['The Office', 'Parks and Rec'],
    ['Friends', 'Seinfeld'], ['Stranger Things', 'Dark'], ['Lost', 'Westworld'], ['Sopranos', 'The Wire'],
    ['Black Mirror', 'Twilight Zone'], ['Sherlock', 'Doctor Who'], ['Peaky Blinders', 'Boardwalk Empire'],
    ['Squid Game', 'Money Heist'], ['Ozark', 'Narcos'], ['Mad Men', 'Suits'], ['Euphoria', 'Skins'],
    ['Family Guy', 'American Dad'], ['South Park', 'The Simpsons'], ['Rick and Morty', 'BoJack Horseman'],
    ['SpongeBob', 'Patrick Star'], ['Arcane', 'Castlevania'], ['The Crown', 'Bridgerton'],
  ],
  // 18+ — unlocked only when ADULTS MODE is on in setup.
  Adults: [
    ['One Night Stand', 'Situationship'], ['Hookup', 'First Date'],
    ['Booty Call', 'Late Night Text'],   ['Ghosted', 'Slow Faded'],
    ['Tinder', 'Hinge'],                  ['Friends With Benefits', 'Casual Dating'],
    ['Walk of Shame', 'Stride of Pride'], ['Hangover', 'Hair of the Dog'],
    ['Bachelor Party', 'Stag Do'],        ['Sugar Daddy', 'Trust Fund Boyfriend'],
    ['Open Relationship', 'Polyamory'],   ['Kink', 'Fetish'],
    ['Strip Club', 'Burlesque'],          ['Lap Dance', 'Slow Dance'],
    ['Dirty Talk', 'Pillow Talk'],        ['Quickie', 'All-Nighter'],
    ['Threesome', 'Double Date'],         ['Wingman', 'Third Wheel'],
    ['Vibrator', 'Massage Gun'],          ['Handcuffs', 'Zip Ties'],
    ['Skinny Dipping', 'Hot Tub Night'],  ['Blackout', 'Brownout'],
    ['Drunk Text', 'Drunk Call'],         ['Sex Tape', 'Home Movie'],
  ],
};

// ── 3. INQUIRY: each player answers a question. Imposter's is different ─────
// Imposter must give an answer that COULD apply to either question. Crew must
// listen for answers that don't quite fit their question.
export const QUESTION_PAIRS = [
  // Personal favorites
  { category: 'Favorites',  crew: "What's your favorite food?",               imposter: "What's your favorite restaurant?" },
  { category: 'Favorites',  crew: "What's your favorite movie?",              imposter: "What's your favorite TV show?" },
  { category: 'Favorites',  crew: "What's your favorite song?",               imposter: "What's your favorite album?" },
  { category: 'Favorites',  crew: "What's your favorite holiday destination?", imposter: "What's your dream holiday destination?" },
  { category: 'Favorites',  crew: "What's your favorite drink?",              imposter: "What's your favorite cocktail?" },
  { category: 'Favorites',  crew: "What's your favorite dessert?",            imposter: "What's your favorite breakfast?" },
  { category: 'Favorites',  crew: "What's your favorite sport to play?",      imposter: "What's your favorite sport to watch?" },
  { category: 'Favorites',  crew: "What's your favorite season?",             imposter: "What's your favorite holiday?" },

  // Hypotheticals
  { category: 'Hypothetical', crew: "If you could have any superpower, what would it be?",       imposter: "If you could have any talent, what would it be?" },
  { category: 'Hypothetical', crew: "What would you do with a million dollars?",                  imposter: "What would you do with unlimited free time?" },
  { category: 'Hypothetical', crew: "If you could time travel, when would you go?",               imposter: "If you could teleport anywhere, where would you go?" },
  { category: 'Hypothetical', crew: "What animal would you want to be?",                          imposter: "What animal best describes you?" },
  { category: 'Hypothetical', crew: "What's your dream job?",                                     imposter: "What job would you NEVER want?" },
  { category: 'Hypothetical', crew: "If you could only eat one food forever, what?",              imposter: "If you could never eat one food again, what?" },
  { category: 'Hypothetical', crew: "If you were stranded on an island, what would you bring?",   imposter: "If you were on a long road trip, what would you bring?" },
  { category: 'Hypothetical', crew: "What's the most useful thing you own?",                      imposter: "What's the most expensive thing you own?" },

  // Memories / experiences
  { category: 'Memory',     crew: "What's the best birthday you've had?",         imposter: "What's the worst birthday you've had?" },
  { category: 'Memory',     crew: "What's the best gift you've received?",        imposter: "What's the best gift you've given?" },
  { category: 'Memory',     crew: "What's the most embarrassing thing you've done?", imposter: "What's the most embarrassing thing you've seen?" },
  { category: 'Memory',     crew: "What's your earliest memory?",                 imposter: "What's your happiest memory?" },
  { category: 'Memory',     crew: "What was your favorite childhood toy?",        imposter: "What was your favorite childhood game?" },
  { category: 'Memory',     crew: "What was the last lie you told?",              imposter: "What was the last secret you kept?" },
  { category: 'Memory',     crew: "What's the longest you've gone without sleep?", imposter: "What's the longest you've gone without food?" },

  // Pop culture
  { category: 'Pop',        crew: "Who's your celebrity crush?",                   imposter: "Who's your dream collab?" },
  { category: 'Pop',        crew: "Who would you want to play you in a movie?",    imposter: "Who would direct your biopic?" },
  { category: 'Pop',        crew: "Which fictional character would you marry?",    imposter: "Which fictional character would you fight?" },
  { category: 'Pop',        crew: "Which movie villain is the scariest?",          imposter: "Which movie villain is the coolest?" },
  { category: 'Pop',        crew: "What's an overrated movie?",                    imposter: "What's an underrated movie?" },
  { category: 'Pop',        crew: "What's a guilty pleasure song?",                imposter: "What's a song you secretly hate?" },

  // Spicy / weird
  { category: 'Spicy',      crew: "What's the weirdest thing you've eaten?",       imposter: "What's the weirdest thing you've drunk?" },
  { category: 'Spicy',      crew: "What's the most illegal thing you've done?",    imposter: "What's the most stupid thing you've done?" },
  { category: 'Spicy',      crew: "What's your biggest fear?",                     imposter: "What's your biggest regret?" },
  { category: 'Spicy',      crew: "What's the worst date you've been on?",         imposter: "What's the best date you've been on?" },
  { category: 'Spicy',      crew: "Who in this group would survive an apocalypse?", imposter: "Who in this group would start an apocalypse?" },
  { category: 'Spicy',      crew: "Who here would you trust with a secret?",       imposter: "Who here would you tell a secret about?" },
  { category: 'Spicy',      crew: "Who here would make the best villain?",         imposter: "Who here would make the worst hero?" },
  { category: 'Spicy',      crew: "What's a deal-breaker in a relationship?",      imposter: "What's a green flag in a relationship?" },
  { category: 'Spicy',      crew: "How drunk do you get on a typical night out?",  imposter: "How hungover do you get on a typical morning?" },

  // Numerical / specific
  { category: 'Numbers',    crew: "How many countries have you visited?",          imposter: "How many countries do you want to visit?" },
  { category: 'Numbers',    crew: "How old were you for your first kiss?",         imposter: "How old were you for your first heartbreak?" },
  { category: 'Numbers',    crew: "How many hours do you sleep on average?",       imposter: "How many hours of screen time per day?" },
  { category: 'Numbers',    crew: "How many siblings do you have?",                imposter: "How many pets have you owned?" },

  // Aesthetic / lifestyle
  { category: 'Lifestyle',  crew: "Describe your dream house.",                    imposter: "Describe your dream car." },
  { category: 'Lifestyle',  crew: "Describe your perfect Sunday.",                 imposter: "Describe your perfect Friday night." },
  { category: 'Lifestyle',  crew: "What's your morning routine?",                  imposter: "What's your evening routine?" },
  { category: 'Lifestyle',  crew: "What's your go-to comfort food?",               imposter: "What's your go-to comfort movie?" },
  { category: 'Lifestyle',  crew: "How do you de-stress?",                         imposter: "How do you procrastinate?" },
  { category: 'Lifestyle',  crew: "What's a small luxury you can't live without?", imposter: "What's a habit you wish you could break?" },

  // This group
  { category: 'Group',      crew: "Who in this room is the funniest?",             imposter: "Who in this room is the loudest?" },
  { category: 'Group',      crew: "Who here would you call at 3 a.m.?",            imposter: "Who here would call YOU at 3 a.m.?" },
  { category: 'Group',      crew: "Who here is most likely to get famous?",        imposter: "Who here is most likely to get arrested?" },
  { category: 'Group',      crew: "Who here is the best dressed?",                 imposter: "Who here is the most stylish?" },
  { category: 'Group',      crew: "Who here would be the best parent?",            imposter: "Who here would be the worst parent?" },
  { category: 'Group',      crew: "Who here is the most adventurous?",             imposter: "Who here is the most reckless?" },

  // Random
  { category: 'Random',     crew: "Window seat or aisle?",                         imposter: "Beach holiday or city break?" },
  { category: 'Random',     crew: "Coffee or tea?",                                imposter: "Hot drink or cold drink?" },
  { category: 'Random',     crew: "Cats or dogs?",                                 imposter: "Indoor pet or outdoor pet?" },
  { category: 'Random',     crew: "Sweet or savory?",                              imposter: "Breakfast or dinner?" },
  { category: 'Random',     crew: "Night owl or early bird?",                      imposter: "Introvert or extrovert?" },

  // 18+ — unlocked only when ADULTS MODE is on in setup.
  { category: 'Adults', crew: "What's your worst hookup story?",                       imposter: "What's your worst date story?" },
  { category: 'Adults', crew: "When did you last sext someone?",                       imposter: "When did you last text your ex?" },
  { category: 'Adults', crew: "What's your biggest turn-on?",                          imposter: "What's your biggest pet peeve?" },
  { category: 'Adults', crew: "What's the wildest one-night stand you've had?",        imposter: "What's the wildest party you've been to?" },
  { category: 'Adults', crew: "What's the kinkiest thing you've ever tried?",          imposter: "What's the riskiest thing you've ever tried?" },
  { category: 'Adults', crew: "What's the worst thing you've done while drunk?",       imposter: "What's the worst thing you've done while hungover?" },
  { category: 'Adults', crew: "Have you ever hooked up with a coworker?",              imposter: "Have you ever fallen out with a coworker?" },
  { category: 'Adults', crew: "What's the strangest place you've had sex?",            imposter: "What's the strangest place you've slept?" },
  { category: 'Adults', crew: "Describe your type in bed.",                            imposter: "Describe your type on paper." },
  { category: 'Adults', crew: "What's a kink you'd never admit on a first date?",      imposter: "What's an opinion you'd never admit on a first date?" },
  { category: 'Adults', crew: "Who in this room would you actually sleep with?",       imposter: "Who in this room would you actually live with?" },
  { category: 'Adults', crew: "What's your sex playlist?",                             imposter: "What's your shower playlist?" },
  { category: 'Adults', crew: "What's the worst sex you've ever had?",                 imposter: "What's the worst date you've ever been on?" },
  { category: 'Adults', crew: "When did you last get caught in the act?",              imposter: "When did you last get caught lying?" },
  { category: 'Adults', crew: "What's the most embarrassing thing in your nightstand?", imposter: "What's the most embarrassing thing in your bathroom?" },
  { category: 'Adults', crew: "What's your hookup deal-breaker?",                      imposter: "What's your housemate deal-breaker?" },
  { category: 'Adults', crew: "How many drinks before you make bad decisions?",        imposter: "How many drinks before you start crying?" },
  { category: 'Adults', crew: "What's a sex move you've heard of but never tried?",    imposter: "What's a dance move you've heard of but never tried?" },
  { category: 'Adults', crew: "What's the morning-after worst-case scenario?",         imposter: "What's the brunch-after worst-case scenario?" },
  { category: 'Adults', crew: "What's a hookup app you've actually used?",             imposter: "What's a dating app you've actually used?" },
];

// ── 4. CHAMELEON: grid of words, crew has one highlighted ──────────────────
// Imposter sees the grid but no target. Each player gives a one-word clue
// related to the target. Imposter must blend in.
export const CHAMELEON_GRIDS = [
  {
    category: 'Movies',
    words: [
      'Titanic', 'Avatar', 'Inception', 'Joker',
      'Frozen', 'Shrek', 'Avengers', 'Rocky',
      'Jaws', 'Matrix', 'Gladiator', 'Coco',
      'Up',     'Cars',  'Moana',    'Encanto',
    ],
  },
  {
    category: 'Foods',
    words: [
      'Pizza',  'Sushi',  'Burger',   'Taco',
      'Pasta',  'Ramen',  'Curry',    'Steak',
      'Salad',  'Bagel',  'Donut',    'Cake',
      'Burrito','Waffle', 'Pancake',  'Lasagna',
    ],
  },
  {
    category: 'Animals',
    words: [
      'Tiger',  'Wolf',  'Eagle',  'Shark',
      'Owl',    'Lion',  'Panda',  'Fox',
      'Bear',   'Snake', 'Horse',  'Octopus',
      'Penguin','Sloth', 'Koala',  'Cheetah',
    ],
  },
  {
    category: 'Sports',
    words: [
      'Soccer',  'Tennis',   'Boxing',    'Golf',
      'Hockey',  'Cricket',  'Surfing',   'Skiing',
      'Rugby',   'Karate',   'Rowing',    'Bowling',
      'Cycling', 'Fencing',  'Climbing',  'Sumo',
    ],
  },
  {
    category: 'Places',
    words: [
      'Beach',   'Mountain', 'Library', 'Castle',
      'Desert',  'Airport',  'Forest',  'Cinema',
      'Cafe',    'Stadium',  'Museum',  'Park',
      'Volcano', 'Pier',     'Hotel',   'Spa',
    ],
  },
  {
    category: 'Pro Wrestlers',
    words: [
      'The Rock',  'Stone Cold', 'Hulk Hogan', 'Undertaker',
      'John Cena', 'Triple H',   'Rey Mysterio','Roman Reigns',
      'CM Punk',   'Ric Flair',  'Andre',      'Macho Man',
      'Edge',      'Kane',       'Big Show',   'Brock Lesnar',
    ],
  },
  {
    category: 'Superheroes',
    words: [
      'Batman',    'Superman', 'Iron Man',     'Thor',
      'Spider-Man','Hulk',     'Captain America','Wolverine',
      'Wonder Woman','Aquaman','Flash',        'Black Widow',
      'Daredevil', 'Deadpool', 'Doctor Strange','Black Panther',
    ],
  },
  {
    category: 'Music Genres',
    words: [
      'Rock',  'Pop',     'Hip Hop', 'Jazz',
      'Blues', 'Country', 'Metal',   'Reggae',
      'Punk',  'Folk',    'R&B',     'Disco',
      'EDM',   'Indie',   'Classical','Funk',
    ],
  },
  // 18+ — unlocked only when ADULTS MODE is on in setup.
  {
    category: 'Adults',
    words: [
      'Quickie',     'Foreplay',  'Threesome',   'Roleplay',
      'Lap Dance',   'Striptease','Massage',     'Shower',
      'Handcuffs',   'Blindfold', 'Toy',         'Lingerie',
      'Body Shot',   'Hickey',    'Aftercare',   'Safe Word',
    ],
  },
  {
    category: 'Adults',
    words: [
      'Ghosted',     'Catfished',     'Drunk Dial',   'Booty Call',
      'Wrong Bed',   'Walk of Shame', 'Sext',         'Tinder',
      'Match',       'Unmatched',     'Situationship','Ex',
      'Rebound',     'Blocked',       'Cheated',      'Hookup',
    ],
  },
];

// ── 5. WILDCARD: imposter has a secret mission ────────────────────────────
// Everyone — crew and imposter — sees the same discussion topic. The imposter
// also receives a SECRET MISSION they must complete during the discussion
// (slip a word in, behave a certain way, drop a reference, etc.) without
// being caught. Crew wins by spotting the player whose answer is "off".
export const WILDCARD_TOPICS = [
  // Travel & adventure
  { category: 'Travel',       topic: 'Describe your dream vacation in detail.' },
  { category: 'Travel',       topic: 'Tell us about the worst travel experience you\'ve had.' },
  { category: 'Travel',       topic: 'If you had to move to another country tomorrow, where and why?' },
  { category: 'Travel',       topic: 'What\'s the strangest place you\'ve ever slept?' },
  { category: 'Travel',       topic: 'Describe a road trip you\'d love to take.' },

  // Childhood & memory
  { category: 'Childhood',    topic: 'Share a vivid memory from when you were a kid.' },
  { category: 'Childhood',    topic: 'What was your favourite toy growing up?' },
  { category: 'Childhood',    topic: 'Tell us about an embarrassing moment from school.' },
  { category: 'Childhood',    topic: 'Who was your hero when you were ten?' },
  { category: 'Childhood',    topic: 'What did you want to be when you grew up?' },

  // Hypotheticals
  { category: 'Hypothetical', topic: 'If you had a superpower for one day, what would you do with it?' },
  { category: 'Hypothetical', topic: 'You can time-travel once. Where and when?' },
  { category: 'Hypothetical', topic: 'You wake up with $10 million in your account. First move?' },
  { category: 'Hypothetical', topic: 'You can swap lives with anyone for a week. Who?' },
  { category: 'Hypothetical', topic: 'You\'re cast in a movie tomorrow. What role?' },

  // Confessions
  { category: 'Confessions',  topic: 'What\'s a weird habit you have that you can\'t shake?' },
  { category: 'Confessions',  topic: 'Name a guilty pleasure you actually defend.' },
  { category: 'Confessions',  topic: 'Something everyone loves that you secretly can\'t stand?' },
  { category: 'Confessions',  topic: 'What\'s a small lie you tell on the regular?' },
  { category: 'Confessions',  topic: 'What\'s the most you\'ve spent on something silly?' },

  // Pop culture
  { category: 'Pop Culture',  topic: 'Recommend a film everyone should watch — and pitch it.' },
  { category: 'Pop Culture',  topic: 'A show you couldn\'t stop watching. Why?' },
  { category: 'Pop Culture',  topic: 'An album that changed how you listen to music.' },
  { category: 'Pop Culture',  topic: 'A book or game that lives in your head rent-free.' },

  // Food
  { category: 'Food',         topic: 'Describe your perfect meal, start to finish.' },
  { category: 'Food',         topic: 'Strangest thing you\'ve ever eaten?' },
  { category: 'Food',         topic: 'Pitch us your signature dish.' },
  { category: 'Food',         topic: 'A food you used to hate but now love.' },

  // The group itself
  { category: 'Group',        topic: 'Describe what the perfect group trip would look like.' },
  { category: 'Group',        topic: 'Share a memory most of us in this room have in common.' },
  { category: 'Group',        topic: 'Who in this room would survive longest on a desert island, and why?' },

  // Future
  { category: 'Future',       topic: 'Where do you see yourself in ten years?' },
  { category: 'Future',       topic: 'A skill you\'d love to have by this time next year.' },
  { category: 'Future',       topic: 'What does retirement look like for you?' },

  // 18+ — unlocked only when ADULTS MODE is on in setup.
  { category: 'Adults',       topic: 'Tell us about your worst hookup.' },
  { category: 'Adults',       topic: 'Describe the wildest date you\'ve ever been on.' },
  { category: 'Adults',       topic: 'What\'s the most embarrassing entry in your dating history?' },
  { category: 'Adults',       topic: 'Tell us about a one-night stand you actually regretted.' },
  { category: 'Adults',       topic: 'Describe your idea of a perfect filthy weekend.' },
  { category: 'Adults',       topic: 'Share something from a bachelor/bachelorette night that never made it home.' },
  { category: 'Adults',       topic: 'Tell us about a time you almost got caught hooking up.' },
  { category: 'Adults',       topic: 'What\'s the worst drunk decision you\'ve ever made?' },
  { category: 'Adults',       topic: 'Share a sex story no one in this room has heard.' },
  { category: 'Adults',       topic: 'What\'s the most chaotic thing you\'ve done at a bar?' },
  { category: 'Adults',       topic: 'Describe a date so bad you fled — and how you got out.' },
  { category: 'Adults',       topic: 'What\'s an ex you owe an apology to, and why?' },
  { category: 'Adults',       topic: 'A kink you tried that did NOT go as planned.' },
  { category: 'Adults',       topic: 'The most you\'ve ever spent on someone you barely knew.' },
  { category: 'Adults',       topic: 'A wild night that\'s now a permanent group chat reference.' },
  { category: 'Adults',       topic: 'Describe your most chaotic dating app interaction.' },
  { category: 'Adults',       topic: 'The strangest place you\'ve ever woken up.' },
  { category: 'Adults',       topic: 'A red flag you ignored — and how that worked out.' },
];

// 18+ wildcard missions — added to the mission pool ONLY when ADULTS MODE is on.
export const WILDCARD_ADULT_MISSIONS = [
  // Word smuggling
  "Slip the word 'naked' into your turn — naturally.",
  "Slip the word 'condom' into your turn — naturally.",
  "Slip the word 'lingerie' into your turn — naturally.",
  "Slip the word 'horny' into your turn — naturally.",
  "Slip the word 'hookup' into your turn — naturally.",
  "Slip the phrase 'in bed' onto the end of one of your sentences.",
  "Use the phrase 'between the sheets' at some point.",
  "Use the word 'naughty' twice.",
  "Use the word 'spicy' as a euphemism.",

  // Themed references
  "Casually mention an ex by name (real or invented).",
  "Reference a specific dating app.",
  "Drop a Tinder/Hinge/Bumble reference.",
  "Mention something you'd find in a sex shop.",
  "Reference an OnlyFans creator (real or invented).",
  "Reference a hangover you've had.",
  "Mention the morning after.",
  "Drop the word 'safeword' into your answer.",
  "Hint at a kink without naming it directly.",
  "Reference a sleeping position — and let it land ambiguously.",
  "Mention a body part in passing — keep it casual.",

  // Performative / social
  "Compliment another player's looks as part of your answer.",
  "Make sustained eye contact with one player while you speak.",
  "Reference a specific cocktail and act like it has a story.",
  "Mention a bachelor or bachelorette party.",
  "Reference a strip club like it's a normal Tuesday.",
  "Slip in a 'that's what she said' joke that actually lands.",
];

export const WILDCARD_MISSIONS = [
  // Word smuggling
  "Slip the word 'pineapple' into your turn — naturally.",
  "Slip the word 'velvet' into your turn — naturally.",
  "Slip the word 'goblin' into your turn — naturally.",
  "Slip the word 'submarine' into your turn — naturally.",
  "Slip the word 'cathedral' into your turn — naturally.",
  "Slip the word 'apricot' into your turn — naturally.",

  // Themed references
  "Reference a specific country at least twice.",
  "Reference the year 1987 somehow.",
  "Mention a number larger than one hundred.",
  "Mention a colour twice — same colour, two times.",
  "Reference a celebrity by their full name.",
  "Find a way to bring up dinosaurs.",
  "Find a way to bring up the moon.",
  "Mention a children’s TV show.",
  "Mention your grandmother.",
  "Bring up the weather, even though nobody asked.",
  "Drop a conspiracy theory casually — like it’s a fact.",
  "Mention a smell or scent at some point.",

  // Phrasing tics
  "Use the word 'frankly' at least twice.",
  "Use the word 'apparently' in your answer.",
  "Begin your turn with the phrase: 'Look, ...'",
  "End your turn with the phrase: '...if that makes sense.'",
  "Use the phrase 'between you and me' at some point.",
  "Refer to yourself in the third person at least once.",
  "Disguise a question as a statement (no question mark voice).",
  "Quote a movie line — don’t reveal it’s a quote.",

  // Performative
  "Whisper one word of your turn so people lean in.",
  "Spell one word out loud (e.g., g-r-e-a-t).",
  "Touch your face or hair noticeably while speaking.",
  "Mispronounce one common word and move on like it’s normal.",
  "Speak slightly slower than everyone else.",
  "Use exactly three sentences. No more, no less.",
  "Speak entirely in past tense for your turn.",

  // Social
  "Compliment another player as part of your answer.",
  "Roast another player gently as part of your answer.",
  "Agree out loud with whoever spoke before you, even if it’s a stretch.",
];

// ── 6. Convenience exports for UI: category lists per mode ────────────────────
export const CLASSIC_CATEGORY_NAMES  = Object.keys(CLASSIC_CATEGORIES);
export const SIMILAR_CATEGORY_NAMES  = Object.keys(SIMILAR_PAIRS);
export const WILDCARD_CATEGORY_NAMES = [...new Set(WILDCARD_TOPICS.map(t => t.category))];

// ── 7. Picker helpers ─────────────────────────────────────────────────────────
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick an item not in the recent history to reduce repeats.
// `recent` is a Set of stringified items used recently.
export function pickFresh(pool, recent, keyFn = (x) => x) {
  const fresh = pool.filter(x => !recent.has(keyFn(x)));
  const source = fresh.length > 0 ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)];
}
