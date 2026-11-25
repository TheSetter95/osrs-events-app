// Bovengrens voor een gemeld of ingestuurd aantal items. Voorkomt absurde of
// verzonnen waarden (bijvoorbeeld een stapel van miljoenen coins of een
// handmatig gemaakt verzoek) in de database.
export const MAX_QUANTITY = 100000
