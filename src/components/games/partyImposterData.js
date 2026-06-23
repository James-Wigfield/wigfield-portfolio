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
  Drinks: [
    'Coffee', 'Espresso', 'Latte', 'Cappuccino', 'Mocha', 'Tea', 'Green Tea', 'Chai',
    'Hot Chocolate', 'Lemonade', 'Iced Tea', 'Cola', 'Root Beer', 'Ginger Ale', 'Orange Juice', 'Apple Juice',
    'Smoothie', 'Milkshake', 'Energy Drink', 'Kombucha', 'Coconut Water', 'Sparkling Water', 'Beer', 'Lager',
    'Cider', 'Wine', 'Champagne', 'Whiskey', 'Vodka', 'Rum', 'Tequila', 'Gin',
    'Margarita', 'Mojito', 'Martini', 'Sangria', 'Eggnog', 'Pina Colada', 'Bloody Mary', 'Negroni',
  ],
  Countries: [
    'Australia', 'Japan', 'Brazil', 'Canada', 'France', 'Italy', 'Spain', 'Germany',
    'Mexico', 'India', 'China', 'Egypt', 'Greece', 'Thailand', 'Indonesia', 'Argentina',
    'Peru', 'Norway', 'Sweden', 'Iceland', 'Ireland', 'Scotland', 'Portugal', 'Morocco',
    'Kenya', 'South Africa', 'Turkey', 'Vietnam', 'Singapore', 'New Zealand', 'Switzerland', 'Netherlands',
    'South Korea', 'Cuba', 'Jamaica', 'Fiji', 'Nepal', 'Chile', 'Colombia', 'Croatia',
  ],
  Vehicles: [
    'Car', 'Truck', 'Motorcycle', 'Bicycle', 'Scooter', 'Bus', 'Train', 'Tram',
    'Subway', 'Airplane', 'Helicopter', 'Jet', 'Hot Air Balloon', 'Boat', 'Yacht', 'Sailboat',
    'Submarine', 'Canoe', 'Kayak', 'Jet Ski', 'Ferry', 'Cruise Ship', 'Ambulance', 'Fire Truck',
    'Police Car', 'Taxi', 'Limousine', 'Tractor', 'Bulldozer', 'Forklift', 'Tank', 'Rocket',
    'Spaceship', 'Skateboard', 'Segway', 'Golf Cart', 'Monster Truck', 'Race Car', 'Snowmobile', 'Hovercraft',
  ],
  Clothing: [
    'T-Shirt', 'Jeans', 'Hoodie', 'Sweater', 'Jacket', 'Coat', 'Blazer', 'Suit',
    'Tuxedo', 'Dress', 'Skirt', 'Shorts', 'Leggings', 'Socks', 'Shoes', 'Sneakers',
    'Boots', 'Sandals', 'Heels', 'Flip Flops', 'Hat', 'Cap', 'Beanie', 'Scarf',
    'Gloves', 'Mittens', 'Belt', 'Tie', 'Bow Tie', 'Pajamas', 'Bathrobe', 'Swimsuit',
    'Bikini', 'Raincoat', 'Poncho', 'Overalls', 'Cardigan', 'Vest', 'Tank Top', 'Onesie',
  ],
  Superheroes: [
    'Superman', 'Batman', 'Spider-Man', 'Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow',
    'Hawkeye', 'Wonder Woman', 'Aquaman', 'The Flash', 'Green Lantern', 'Wolverine', 'Deadpool', 'Doctor Strange',
    'Black Panther', 'Captain Marvel', 'Ant-Man', 'Scarlet Witch', 'Vision', 'Star-Lord', 'Groot', 'Rocket Raccoon',
    'Daredevil', 'The Punisher', 'Green Arrow', 'Cyclops', 'Storm', 'Jean Grey', 'Professor X', 'Magneto',
    'Robin', 'Catwoman', 'Nightwing', 'Supergirl', 'Shazam', 'Venom', 'Gambit', 'Silver Surfer',
  ],
  Emotions: [
    'Happy', 'Sad', 'Angry', 'Excited', 'Nervous', 'Scared', 'Jealous', 'Proud',
    'Embarrassed', 'Confused', 'Bored', 'Curious', 'Surprised', 'Disappointed', 'Grateful', 'Lonely',
    'Hopeful', 'Anxious', 'Relaxed', 'Frustrated', 'Guilty', 'Confident', 'Shy', 'Overwhelmed',
    'Content', 'Furious', 'Ecstatic', 'Heartbroken', 'Optimistic', 'Annoyed', 'Peaceful', 'Terrified',
    'Joyful', 'Insecure', 'Determined', 'Homesick',
  ],
  Hobbies: [
    'Painting', 'Drawing', 'Photography', 'Gardening', 'Cooking', 'Baking', 'Knitting', 'Reading',
    'Writing', 'Journaling', 'Hiking', 'Camping', 'Fishing', 'Surfing', 'Skateboarding', 'Cycling',
    'Running', 'Yoga', 'Dancing', 'Singing', 'Gaming', 'Chess', 'Puzzles', 'Pottery',
    'Woodworking', 'Origami', 'Birdwatching', 'Stargazing', 'Collecting', 'Scrapbooking', 'Calligraphy', 'Juggling',
    'Magic Tricks', 'Rock Climbing', 'Scuba Diving', 'Skiing',
  ],
  Holidays: [
    'Christmas', 'Halloween', 'Easter', 'Thanksgiving', 'New Year', 'Valentine\'s Day', 'Birthday', 'Wedding',
    'Anniversary', 'Graduation', 'Diwali', 'Hanukkah', 'Ramadan', 'Lunar New Year', 'St. Patrick\'s Day', 'Mardi Gras',
    'April Fools', 'Mother\'s Day', 'Father\'s Day', 'Labor Day', 'Independence Day', 'Memorial Day', 'Cinco de Mayo', 'Oktoberfest',
    'Carnival', 'Day of the Dead', 'Boxing Day', 'Black Friday', 'Super Bowl', 'Coachella', 'Eid', 'Holi',
    'Songkran', 'Bonfire Night', 'Pancake Day', 'Earth Day',
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
    'Make-Out Session', 'Netflix and Chill', 'Booty Text', 'Thirst Trap',
    'DTR Talk', 'Friends to Lovers', 'Slow Burn', 'Speed Dating',
    'Blind Date', 'Cuddle Puddle', 'Morning After', 'Love Bite',
    'Naughty List', 'Love Triangle', 'Friend Zone', 'Cougar',
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
  Drinks: [
    ['Coffee', 'Tea'], ['Latte', 'Cappuccino'], ['Espresso', 'Americano'], ['Cola', 'Root Beer'],
    ['Lemonade', 'Iced Tea'], ['Smoothie', 'Milkshake'], ['Beer', 'Cider'], ['Wine', 'Champagne'],
    ['Whiskey', 'Bourbon'], ['Vodka', 'Gin'], ['Rum', 'Tequila'], ['Margarita', 'Mojito'],
    ['Martini', 'Cosmopolitan'], ['Hot Chocolate', 'Mocha'], ['Orange Juice', 'Apple Juice'], ['Energy Drink', 'Soda'],
    ['Kombucha', 'Sparkling Water'], ['Sangria', 'Punch'],
  ],
  Vehicles: [
    ['Car', 'Truck'], ['Motorcycle', 'Scooter'], ['Bicycle', 'Tricycle'], ['Bus', 'Tram'],
    ['Train', 'Subway'], ['Airplane', 'Jet'], ['Helicopter', 'Drone'], ['Boat', 'Yacht'],
    ['Canoe', 'Kayak'], ['Submarine', 'Ship'], ['Ambulance', 'Fire Truck'], ['Taxi', 'Limousine'],
    ['Tractor', 'Bulldozer'], ['Rocket', 'Spaceship'], ['Jet Ski', 'Speedboat'], ['Ferry', 'Cruise Ship'],
    ['Van', 'Minivan'], ['SUV', 'Pickup'],
  ],
  Clothing: [
    ['T-Shirt', 'Tank Top'], ['Jeans', 'Trousers'], ['Hoodie', 'Sweater'], ['Jacket', 'Coat'],
    ['Suit', 'Tuxedo'], ['Dress', 'Gown'], ['Skirt', 'Shorts'], ['Sneakers', 'Trainers'],
    ['Boots', 'Sandals'], ['Heels', 'Flats'], ['Hat', 'Cap'], ['Beanie', 'Scarf'],
    ['Gloves', 'Mittens'], ['Belt', 'Suspenders'], ['Tie', 'Bow Tie'], ['Pajamas', 'Bathrobe'],
    ['Swimsuit', 'Bikini'], ['Cardigan', 'Vest'],
  ],
  Superheroes: [
    ['Superman', 'Batman'], ['Spider-Man', 'Daredevil'], ['Iron Man', 'War Machine'], ['Thor', 'Hercules'],
    ['Hulk', 'Abomination'], ['Wonder Woman', 'Captain Marvel'], ['Aquaman', 'Namor'], ['The Flash', 'Quicksilver'],
    ['Wolverine', 'Sabretooth'], ['Deadpool', 'Deathstroke'], ['Black Widow', 'Hawkeye'], ['Doctor Strange', 'Scarlet Witch'],
    ['Green Lantern', 'Green Arrow'], ['Robin', 'Nightwing'], ['Catwoman', 'Black Cat'], ['Professor X', 'Magneto'],
    ['Star-Lord', 'Nova'], ['Venom', 'Carnage'],
  ],
  Body: [
    ['Eyes', 'Ears'], ['Hands', 'Feet'], ['Arms', 'Legs'], ['Fingers', 'Toes'],
    ['Lips', 'Cheeks'], ['Knees', 'Elbows'], ['Wrist', 'Ankle'], ['Heart', 'Lungs'],
    ['Brain', 'Spine'], ['Hair', 'Beard'], ['Nose', 'Chin'], ['Teeth', 'Tongue'],
    ['Shoulders', 'Hips'], ['Stomach', 'Chest'], ['Liver', 'Kidney'], ['Skull', 'Ribs'],
    ['Eyebrows', 'Eyelashes'], ['Thumb', 'Pinky'],
  ],
  Countries: [
    ['Spain', 'Portugal'], ['Norway', 'Sweden'], ['Canada', 'USA'], ['China', 'Japan'],
    ['India', 'Pakistan'], ['Greece', 'Italy'], ['Brazil', 'Argentina'], ['Egypt', 'Morocco'],
    ['Thailand', 'Vietnam'], ['Ireland', 'Scotland'], ['Australia', 'New Zealand'], ['Germany', 'Austria'],
    ['France', 'Belgium'], ['Mexico', 'Cuba'], ['Kenya', 'Tanzania'], ['Peru', 'Chile'],
    ['Iceland', 'Greenland'], ['Singapore', 'Hong Kong'],
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
    ['Make-Out', 'First Kiss'],            ['Netflix and Chill', 'Movie Night'],
    ['Thirst Trap', 'Selfie'],            ['Speed Dating', 'Blind Date'],
    ['Love Bite', 'Bruise'],              ['Slow Burn', 'Whirlwind Romance'],
    ['Friends With Benefits', 'Just Friends'], ['Booty Call', 'Wrong Number'],
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
  { category: 'Random',     crew: "Mountains or ocean?",                           imposter: "Sunrise or sunset?" },
  { category: 'Random',     crew: "Texting or calling?",                           imposter: "Email or face-to-face?" },
  { category: 'Random',     crew: "Summer or winter?",                            imposter: "Morning or night?" },

  // Work & career
  { category: 'Work',       crew: "What's the worst job you've ever had?",         imposter: "What's the best job you've ever had?" },
  { category: 'Work',       crew: "What would make you quit a job on day one?",    imposter: "What would make you stay at a job forever?" },
  { category: 'Work',       crew: "Who's the worst boss you've had?",              imposter: "Who's the best mentor you've had?" },
  { category: 'Work',       crew: "What's your most useless skill?",               imposter: "What's your most useful skill?" },

  // Travel
  { category: 'Travel',     crew: "What's the best place you've ever travelled?",  imposter: "What's the next place you want to travel?" },
  { category: 'Travel',     crew: "What's your worst travel horror story?",        imposter: "What's your funniest travel story?" },
  { category: 'Travel',     crew: "Beach resort or backpacking trip?",            imposter: "City tour or mountain retreat?" },
  { category: 'Travel',     crew: "What's one thing you always pack?",             imposter: "What's one thing you always forget to pack?" },

  // Food
  { category: 'Food',       crew: "What's a food you could eat every day?",        imposter: "What's a food you're sick of?" },
  { category: 'Food',       crew: "What's your signature dish?",                   imposter: "What's a dish you completely ruined?" },
  { category: 'Food',       crew: "Pineapple on pizza — yes or no?",               imposter: "Ketchup on eggs — yes or no?" },
  { category: 'Food',       crew: "What's your go-to takeaway order?",             imposter: "What's your go-to hangover meal?" },

  // Deep
  { category: 'Deep',       crew: "What's something you've changed your mind about?", imposter: "What's something you'll never change your mind about?" },
  { category: 'Deep',       crew: "What advice would you give your younger self?", imposter: "What advice would you give your future self?" },
  { category: 'Deep',       crew: "What's a fear you've overcome?",                imposter: "What's a fear you still have?" },
  { category: 'Deep',       crew: "What makes you feel most alive?",               imposter: "What makes you feel most at peace?" },

  // Money
  { category: 'Money',      crew: "What's the best money you've ever spent?",      imposter: "What's the worst money you've ever spent?" },
  { category: 'Money',      crew: "What would you buy if money didn't matter?",    imposter: "What would you do if you never had to work?" },

  // More pop culture
  { category: 'Pop',        crew: "What show have you rewatched the most?",        imposter: "What movie have you rewatched the most?" },
  { category: 'Pop',        crew: "What's a trend you actually fell for?",         imposter: "What's a trend you refused to follow?" },

  // More group
  { category: 'Group',      crew: "Who here gives the best advice?",               imposter: "Who here gives the worst advice?" },
  { category: 'Group',      crew: "Who here would survive a zombie apocalypse?",   imposter: "Who here would die first in a horror movie?" },

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
  { category: 'Adults', crew: "What's your biggest first-date red flag?",             imposter: "What's your biggest first-date green flag?" },
  { category: 'Adults', crew: "What's the longest dry spell you've had?",             imposter: "What's the longest relationship you've had?" },
  { category: 'Adults', crew: "What's your most-used pickup line?",                   imposter: "What's your most-used excuse to leave early?" },
  { category: 'Adults', crew: "Who was your worst ex?",                               imposter: "Who was your craziest ex?" },
  { category: 'Adults', crew: "Boldest thing you've done to get someone's attention?", imposter: "Boldest thing you've done to avoid someone?" },
  { category: 'Adults', crew: "What's your go-to hookup outfit?",                     imposter: "What's your go-to comfort outfit?" },
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
  {
    category: 'Countries',
    words: [
      'Japan',    'Brazil',  'France',   'Egypt',
      'Canada',   'India',   'Mexico',   'Italy',
      'Spain',    'Greece',  'Norway',   'Kenya',
      'Thailand', 'Peru',    'Iceland',  'Cuba',
    ],
  },
  {
    category: 'Drinks',
    words: [
      'Coffee',   'Latte',   'Cola',     'Beer',
      'Wine',     'Whiskey', 'Vodka',    'Mojito',
      'Lemonade', 'Smoothie','Tea',      'Martini',
      'Cider',    'Rum',     'Espresso', 'Margarita',
    ],
  },
  {
    category: 'TV Shows',
    words: [
      'Friends',  'Seinfeld', 'Lost',      'Dexter',
      'Euphoria', 'Severance','Succession','Ozark',
      'Narcos',   'Fargo',    'Westworld', 'Bridgerton',
      'Arcane',   'Sherlock', 'Vikings',   'Suits',
    ],
  },
  {
    category: 'Video Games',
    words: [
      'Mario',    'Zelda',    'Minecraft', 'Fortnite',
      'Halo',     'Tetris',   'Pokémon',   'Sonic',
      'Doom',     'Skyrim',   'Portal',    'Pac-Man',
      'Roblox',   'Valorant', 'Among Us',  'Fallout',
    ],
  },
  {
    category: 'Cars',
    words: [
      'Ferrari',  'Lamborghini','Porsche', 'Tesla',
      'Toyota',   'Ford',     'BMW',       'Audi',
      'Honda',    'Jeep',     'Bugatti',   'Mustang',
      'Mini',     'Volvo',    'Mazda',     'Subaru',
    ],
  },
  {
    category: 'Body Parts',
    words: [
      'Heart',    'Brain',    'Eyes',      'Hands',
      'Feet',     'Knees',    'Elbows',    'Lungs',
      'Spine',    'Liver',    'Teeth',     'Tongue',
      'Shoulders','Ankles',   'Ribs',      'Skull',
    ],
  },
  {
    category: 'Jobs',
    words: [
      'Doctor',   'Teacher',  'Chef',      'Pilot',
      'Lawyer',   'Nurse',    'Artist',    'Police',
      'Farmer',   'Plumber',  'Actor',     'Scientist',
      'Barista',  'Soldier',  'Judge',     'Engineer',
    ],
  },
  {
    category: 'Disney',
    words: [
      'Mickey',   'Simba',    'Elsa',      'Ariel',
      'Stitch',   'Genie',    'Woody',     'Buzz',
      'Nemo',     'Dory',     'Olaf',      'Moana',
      'Belle',    'Mulan',    'Aladdin',   'Bambi',
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
  { category: 'Future',       topic: 'What\'s one thing you want to achieve before you\'re 40?' },

  // Work
  { category: 'Work',         topic: 'Describe your dream job that doesn\'t exist yet.' },
  { category: 'Work',         topic: 'What\'s the worst job you could possibly imagine having?' },
  { category: 'Work',         topic: 'Pitch a business idea you\'d actually fund.' },

  // Money
  { category: 'Money',        topic: 'You get $1000 you must spend in one hour. Go.' },
  { category: 'Money',        topic: 'What\'s a purchase you\'ll never regret?' },

  // Deep
  { category: 'Deep',         topic: 'What\'s something that changed the way you see the world?' },
  { category: 'Deep',         topic: 'Describe what your perfect ordinary day looks like.' },

  // Embarrassing
  { category: 'Embarrassing', topic: 'Tell us about a time you completely misread a situation.' },
  { category: 'Embarrassing', topic: 'What\'s the most awkward text you\'ve ever sent?' },

  // More from existing themes
  { category: 'Travel',       topic: 'What\'s a place that totally lived up to the hype?' },
  { category: 'Childhood',    topic: 'What show or movie defined your childhood?' },
  { category: 'Hypothetical', topic: 'You can master any skill instantly. Which one, and why?' },
  { category: 'Confessions',  topic: 'What\'s the pettiest hill you\'ll die on?' },
  { category: 'Pop Culture',  topic: 'What\'s a movie everyone loves that you just don\'t get?' },
  { category: 'Food',         topic: 'What\'s your ultimate comfort food, and the story behind it?' },
  { category: 'Group',        topic: 'Who in this room would give the best wedding speech, and why?' },

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
  { category: 'Adults',       topic: 'What\'s the most scandalous rumour you\'ve heard about someone here?' },
  { category: 'Adults',       topic: 'Describe the most chaotic night out that ended in disaster.' },
  { category: 'Adults',       topic: 'What\'s a dating-app message that actually made you respond?' },
  { category: 'Adults',       topic: 'Confess the pettiest reason you\'ve ever ended things with someone.' },
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
  "Slip the word 'lipstick' into your turn — naturally.",
  "Reference a walk of shame.",
  "Mention a questionable text you sent last weekend.",
  "Drop a 'no strings attached' reference.",
  "Compliment someone's outfit a little too enthusiastically.",
  "Work in a reference to a hot tub.",
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

  // More word smuggling
  "Slip the word 'avalanche' into your turn — naturally.",
  "Slip the word 'mustard' into your turn — naturally.",
  "Slip the word 'wizard' into your turn — naturally.",
  "Slip the word 'tornado' into your turn — naturally.",

  // More themed references
  "Work in a reference to outer space.",
  "Mention a famous landmark by name.",
  "Bring up a board game somehow.",
  "Reference a decade that isn't this one.",
  "Mention a fruit that isn't an apple.",

  // More phrasing tics
  "Use the word 'honestly' at least three times.",
  "Start your turn with 'So, here's the thing...'",
  "End every sentence as if it's a question.",

  // More performative
  "Pause dramatically before your final sentence.",
  "Use a hand gesture for every point you make.",
  "Subtly mirror the body language of the person across from you.",
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
