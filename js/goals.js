// Reading goal: "this year I want to read N books".
// A book counts for the year of its "Uitgelezen op" date (finishedAt).
import { getSetting, setSetting } from "./db.js";

const goalKey = (year) => `readingGoal-${year}`;
const celebratedKey = (year) => `goalCelebrated-${year}`;

export const getGoal = (year) => getSetting(goalKey(year), null);
export async function setGoal(year, count) {
  await setSetting(goalKey(year), count > 0 ? Math.round(count) : null);
  await setSetting(celebratedKey(year), false); // a new goal deserves its own party
}

// Has the "goal reached" party already been shown this year?
export const wasCelebrated = async (year) => Boolean(await getSetting(celebratedKey(year), false));
export const markCelebrated = (year) => setSetting(celebratedKey(year), true);

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date - start) / 86_400_000) + 1;
}
const daysInYear = (year) => (new Date(year, 1, 29).getMonth() === 1 ? 366 : 365);

// Everything the goal card needs. `today` can be passed in for testing.
export function goalProgress(books, goal, year, today = new Date()) {
  const read = books
    .filter((b) => b.status === "gelezen" && b.finishedAt?.startsWith(String(year)))
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  const readWithoutDate = books.filter((b) => b.status === "gelezen" && !b.finishedAt).length;

  const progress = { year, goal, count: read.length, read, readWithoutDate };
  if (!goal) return progress;

  // Where you'd be if you read at an even pace through the year
  const fraction =
    today.getFullYear() > year ? 1 :
    today.getFullYear() < year ? 0 :
    dayOfYear(today) / daysInYear(year);
  const expected = goal * fraction;
  const ahead = Math.round((read.length - expected) * 10) / 10; // e.g. 1.4 books ahead

  return {
    ...progress,
    left: Math.max(0, goal - read.length),
    percent: Math.min(100, Math.round((read.length / goal) * 100)),
    reached: read.length >= goal,
    ahead,
  };
}

// Friendly sentence about the schedule.
export function scheduleText(p) {
  const books = (n) => (n === 1 ? "1 boek" : `${n} boeken`);
  if (p.reached) {
    const extra = p.count - p.goal;
    return extra > 0 ? `Doel gehaald, en nog ${books(extra)} extra! 🎉` : "Doel gehaald! 🎉";
  }
  const whole = Math.trunc(p.ahead); // less than a whole book off counts as "on schedule"
  if (whole >= 1) return `Je loopt ${books(whole)} voor op schema ✨`;
  if (whole <= -1) return `${books(-whole)} achter op schema, je kunt het nog halen 💪`;
  return "Precies op schema ✨";
}
