// Milestone badges: earned once per player for reaching some progress. Stored as badges (see db/milestones.ts).
// To add one: add it to MILESTONES (and to firestore.rules), then to reachedMilestones or award it on an event.

import type { DateKey } from "../common";
import type { Habit } from "../db/habits";
import type { BadgeInfo } from "./badges";
import { clearLeaderId, habitStandings } from "./progress";

export const MILESTONES = {
  firstHabit: { emoji: "🌱", label: "First habit", description: "Joined or created your first habit." },
  habitMaker: { emoji: "🔨", label: "Habit maker", description: "Created a habit." },
  threeHabits: { emoji: "🧩", label: "Habit collector", description: "In 3 habits at once." },
  fiveHabits: { emoji: "🎪", label: "Juggler", description: "In 5 habits at once." },
  firstCheckIn: { emoji: "✅", label: "First check-in", description: "Checked in for the first time." },
  tenCheckIns: { emoji: "🔟", label: "Getting serious", description: "10 check-ins in your habits." },
  fiftyCheckIns: { emoji: "🎯", label: "Dedicated", description: "50 check-ins in your habits." },
  hundredCheckIns: { emoji: "💯", label: "Centurion", description: "100 check-ins in your habits." },
  streak3: { emoji: "✨", label: "On a roll", description: "3 check-ins in a row without a miss in one habit." },
  streak14: { emoji: "⚡", label: "Two weeks strong", description: "14 check-ins in a row without a miss in one habit." },
  streak30: { emoji: "🗻", label: "Iron will", description: "30 check-ins in a row without a miss in one habit." },
  hundredPoints: { emoji: "💰", label: "Point hoarder", description: "100 points in one habit." },
  leader: { emoji: "👑", label: "Top of the board", description: "Led a habit's leaderboard against at least one rival." },
  firstFriend: { emoji: "🤝", label: "First friend", description: "Added your first friend." },
  squad: { emoji: "👥", label: "Squad", description: "Have 5 friends." },
  firstTaunt: { emoji: "😏", label: "Trash talker", description: "Sent your first taunt." },
  comeback: { emoji: "🦸", label: "Comeback", description: "Checked in while being a Lazy Snail." },
} satisfies Record<string, BadgeInfo>;

export type MilestoneType = keyof typeof MILESTONES;

export const MILESTONE_TYPES = Object.keys(MILESTONES) as MilestoneType[];

// The habit a milestone was reached in, if it belongs to one.
type MilestoneHabit = Pick<Habit, "id" | "name">;

export type ReachedMilestone = { type: MilestoneType; habit: MilestoneHabit | null };

// Milestones the player has reached with their current habits and friends. "firstTaunt" and "comeback"
// are awarded when they happen instead (see sendTaunt and checkIn).
export const reachedMilestones = (
  userId: string,
  habits: Habit[],
  friendCount: number,
  today: DateKey,
): ReachedMilestone[] => {
  const reached: ReachedMilestone[] = [];
  const add = (type: MilestoneType, habit: MilestoneHabit | null = null) => reached.push({ type, habit });
  const myHabits = habits.filter((habit) => habit.members[userId]);
  const totalCheckIns = myHabits.reduce((sum, habit) => sum + habit.members[userId].totalCheckIns, 0);

  // The habit where the player's value is highest, or null if no habit reaches `atLeast`.
  const bestHabit = (value: (habit: Habit) => number, atLeast: number) => {
    let best: Habit | null = null;

    for (const habit of myHabits) {
      if (value(habit) >= atLeast && (!best || value(habit) > value(best))) {
        best = habit;
      }
    }

    return best;
  };

  const standingOf = (habit: Habit) =>
    habitStandings(habit, today).find((standing) => standing.userId === userId);

  // [milestone, value needed].
  const thresholds = (value: number, levels: [MilestoneType, number][]) => {
    for (const [type, needed] of levels) {
      if (value >= needed) {
        add(type);
      }
    }
  };

  thresholds(myHabits.length, [["firstHabit", 1], ["threeHabits", 3], ["fiveHabits", 5]]);
  thresholds(totalCheckIns, [["firstCheckIn", 1], ["tenCheckIns", 10], ["fiftyCheckIns", 50], ["hundredCheckIns", 100]]);
  thresholds(friendCount, [["firstFriend", 1], ["squad", 5]]);

  const created = myHabits.find((habit) => habit.creatorId === userId);

  if (created) {
    add("habitMaker", created);
  }

  // Streaks and points include penalties that are due but not saved yet, like the leaderboards.
  const streak = (habit: Habit) => standingOf(habit)?.streak ?? 0;
  const points = (habit: Habit) => standingOf(habit)?.points ?? 0;
  const perHabit: [MilestoneType, (habit: Habit) => number, number][] = [
    ["streak3", streak, 3],
    ["streak14", streak, 14],
    ["streak30", streak, 30],
    ["hundredPoints", points, 100],
  ];

  for (const [type, value, needed] of perHabit) {
    const habit = bestHabit(value, needed);

    if (habit) {
      add(type, habit);
    }
  }

  const led = myHabits.find(
    (habit) => habit.memberIds.length >= 2 && clearLeaderId(habitStandings(habit, today)) === userId,
  );

  if (led) {
    add("leader", led);
  }

  return reached;
};
