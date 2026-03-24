const getUrl = (user) => {
  return (
    "https://img.shields.io/badge/dynamic/json?url=https://leetcode-api-pied.vercel.app/user/" +
    user +
    "&query=submitStats.acSubmissionNum[0].count&label=LeetCode%20Problems%20Solved&color=D97F0C&style=for-the-badge"
  );
};
/**
 * Given a username return a simple svg from shields.io
 * @param {string} username leetcode username
 * @returns SVG
 */
export async function fetchLeetCodeBadge(username) {
  const url = getUrl(username);
  const response = await fetch(url);

  // IMPORTANT: Shields.io returns SVG, so use .text()
  const svg = await response.text();

  return svg;
}
