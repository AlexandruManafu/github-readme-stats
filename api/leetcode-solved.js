import {
  CACHE_TTL,
  resolveCacheSeconds,
  setCacheHeaders,
  setErrorCacheHeaders,
} from "../src/common/cache.js";
import {
  MissingParamError,
  retrieveSecondaryMessage,
} from "../src/common/error.js";
import { renderError } from "../src/common/render.js";

import { fetchLeetCodeBadge } from "../src/cards/leetcode-solved.js";

// @ts-ignore
export default async (req, res) => {
  const {
    title_color,
    text_color,
    bg_color,
    theme,
    cache_seconds,
    border_color,
  } = req.query;
  res.setHeader("Content-Type", "image/svg+xml");

  const username = process.env.LEETCODE_USER;

  if (!username) {
    return res.send(
      renderError({
        message: "Missing LEETCODE_USER",
        secondaryMessage: "Set it in your Vercel environment variables",
      }),
    );
  }

  try {
    const badgeSvg = await fetchLeetCodeBadge(username);
    const cacheSeconds = resolveCacheSeconds({
      requested: parseInt(cache_seconds, 10),
      def: CACHE_TTL.STATS_CARD.DEFAULT,
      min: CACHE_TTL.STATS_CARD.MIN,
      max: CACHE_TTL.STATS_CARD.MAX,
    });

    setCacheHeaders(res, cacheSeconds);

    return res.send(badgeSvg);
  } catch (err) {
    setErrorCacheHeaders(res);
    if (err instanceof Error) {
      return res.send(
        renderError({
          message: err.message,
          secondaryMessage: retrieveSecondaryMessage(err),
          renderOptions: {
            title_color,
            text_color,
            bg_color,
            border_color,
            theme,
            show_repo_link: !(err instanceof MissingParamError),
          },
        }),
      );
    }
    return res.send(
      renderError({
        message: "An unknown error occurred",
        renderOptions: {
          title_color,
          text_color,
          bg_color,
          border_color,
          theme,
        },
      }),
    );
  }
};
