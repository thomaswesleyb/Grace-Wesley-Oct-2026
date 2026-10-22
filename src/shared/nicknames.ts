/**
 * Common English given names and their nicknames. A typed first name matches a guest listed
 * under any other name in its group, so "Bob Smith" finds "Robert Smith" and the reverse.
 * Names are lowercase and unaccented, as `normalizeName` produces them.
 */
const GROUPS = [
  "abigail abby abbie gail",
  "alexander alex xander sandy",
  "alexandra alex alexa lexi sandra",
  "andrew andy drew",
  "anthony tony",
  "barbara barb barbie",
  "benjamin ben benji",
  "catherine cathy cat kate katie",
  "charles charlie chuck chaz",
  "christina tina chris christy",
  "christine chris christy",
  "christopher chris topher kit",
  "daniel dan danny",
  "david dave davey",
  "deborah debbie deb",
  "donald don donnie",
  "dorothy dot dottie",
  "edward ed eddie ted ned",
  "elizabeth liz lizzie beth betsy betty eliza libby",
  "emily em emmy",
  "frederick fred freddie",
  "gregory greg",
  "harold hal harry",
  "henry hank harry",
  "jacob jake",
  "james jim jimmy jamie",
  "jennifer jen jenny",
  "jessica jess jessie",
  "jonathan jon jonny",
  "john johnny jack",
  "joseph joe joey",
  "joshua josh",
  "katherine kathy kate katie kat kathryn",
  "kathleen kathy kate katie",
  "kenneth ken kenny",
  "lawrence larry",
  "margaret maggie meg peggy marge",
  "matthew matt",
  "michael mike mikey mick",
  "nathaniel nate nathan nat",
  "nicholas nick nicky",
  "pamela pam",
  "patricia pat patty trish tricia",
  "patrick pat paddy",
  "peter pete",
  "rebecca becky becca",
  "richard rick ricky rich dick",
  "robert rob bob bobby robbie bert",
  "ronald ron ronnie",
  "samantha sam sammy",
  "samuel sam sammy",
  "stephen steve stevie",
  "steven steve stevie",
  "susan sue susie",
  "theodore ted teddy theo",
  "thomas tom tommy",
  "timothy tim timmy",
  "victoria vicky tori",
  "william will bill billy willy liam",
  "zachary zach zack",
].map((group) => group.split(" "));

/** Every other name that shares a group with `first` (lowercase, unaccented). */
export function nicknamesOf(first: string): string[] {
  const names = new Set<string>();
  for (const group of GROUPS) {
    if (group.includes(first)) for (const name of group) names.add(name);
  }
  names.delete(first);
  return [...names];
}
