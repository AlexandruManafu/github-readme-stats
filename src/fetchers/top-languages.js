// @ts-check

import { retryer } from "../common/retryer.js";
import { logger } from "../common/log.js";
import { excludeRepositories } from "../common/envs.js";
import { CustomError, MissingParamError } from "../common/error.js";
import { wrapTextMultiline } from "../common/fmt.js";
import { request } from "../common/http.js";

/**
 * Top languages fetcher object.
 *
 * @param {any} variables Fetcher variables.
 * @param {string} token GitHub token.
 * @returns {Promise<import("axios").AxiosResponse>} Languages fetcher response.
 */
const fetcher = (variables, token) => {
  return request(
    {
      query: `
      query userInfo($login: String!) {
        user(login: $login) {
          # fetch only owner repos & not forks
          repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
            nodes {
              name
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    color
                    name
                  }
                }
              }
            }
          }
        }
      }
      `,
      variables,
    },
    {
      Authorization: `token ${token}`,
    },
  );
};

/**
 * @typedef {import("./types").TopLangData} TopLangData Top languages data.
 */

/**
 * Fetch top languages for a given username.
 *
 * @param {string} username GitHub username.
 * @param {string[]} exclude_repo List of repositories to exclude.
 * @param {number} size_weight Weightage to be given to size.
 * @param {number} count_weight Weightage to be given to count.
 * @param {string[]} included_paths List of repositories to include (if provided, only these will be counted).
 * @param {string} path_lang Language overrides in format "repo1=lang1,lang2|repo2=lang3".
 * @returns {Promise<TopLangData>} Top languages data.
 */
const fetchTopLanguages = async (
  username,
  exclude_repo = [],
  size_weight = 1,
  count_weight = 0,
  included_paths = [],
  path_lang = "",
) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  const res = await retryer(fetcher, { login: username });

  if (res.data.errors) {
    logger.error(res.data.errors);
    if (res.data.errors[0].type === "NOT_FOUND") {
      throw new CustomError(
        res.data.errors[0].message || "Could not fetch user.",
        CustomError.USER_NOT_FOUND,
      );
    }
    if (res.data.errors[0].message) {
      throw new CustomError(
        wrapTextMultiline(res.data.errors[0].message, 90, 1)[0],
        res.statusText,
      );
    }
    throw new CustomError(
      "Something went wrong while trying to retrieve the language data using the GraphQL API.",
      CustomError.GRAPHQL_ERROR,
    );
  }

  let repoNodes = res.data.data.user.repositories.nodes;
  /** @type {Record<string, boolean>} */
  let repoToHide = {};
  const allExcludedRepos = [...exclude_repo, ...excludeRepositories];

  // Parse path_lang overrides into a map
  /** @type {Record<string, string[]>} */
  const pathLangMap = {};
  if (path_lang) {
    const pathLangPairs = path_lang.split("|");
    pathLangPairs.forEach((pair) => {
      const [repoName, langs] = pair.split(":");
      if (repoName && langs) {
        pathLangMap[repoName.trim()] = langs
          .split(",")
          .map((lang) => lang.trim());
      }
    });
  }

  // populate repoToHide map for quick lookup
  // while filtering out
  if (allExcludedRepos) {
    allExcludedRepos.forEach((repoName) => {
      repoToHide[repoName] = true;
    });
  }

  // filter out repositories to be hidden
  repoNodes = repoNodes
    .sort((a, b) => b.size - a.size)
    .filter((name) => !repoToHide[name.name]);

  // if included_paths is provided, only include those repositories
  if (included_paths && included_paths.length > 0) {
    const includedReposMap = {};
    included_paths.forEach((repoName) => {
      includedReposMap[repoName.toLowerCase()] = true;
    });
    repoNodes = repoNodes.filter(
      (name) => includedReposMap[name.name.toLowerCase()],
    );
  }

  // Process repositories while preserving repo information for overrides
  const langData = {};
  repoNodes
    .filter((node) => node.languages.edges.length > 0)
    .forEach((repo) => {
      // Check if this repo has language overrides
      const overrideLangs = pathLangMap[repo.name];
      if (overrideLangs) {
        // If override exists, use specified languages with equal distribution
        const totalSize = repo.languages.edges.reduce(
          (sum, edge) => sum + edge.size,
          0,
        );
        const sizePerLang = totalSize / overrideLangs.length;

        overrideLangs.forEach((langName) => {
          const langKey = langName.trim();
          if (!langData[langKey]) {
            langData[langKey] = {
              name: langKey,
              color: "#858585", // default color for overridden languages
              size: 0,
              count: 0,
            };
          }
          langData[langKey].size += sizePerLang;
          langData[langKey].count += 1;
        });
      } else {
        // Use detected languages from GitHub API
        repo.languages.edges.forEach((edge) => {
          const langName = edge.node.name;
          if (!langData[langName]) {
            langData[langName] = {
              name: langName,
              color: edge.node.color,
              size: 0,
              count: 0,
            };
          }
          langData[langName].size += edge.size;
          langData[langName].count += 1;
        });
      }
    });

  // Convert to old format for compatibility
  let repoNodes2 = langData;

  Object.keys(repoNodes2).forEach((name) => {
    // comparison index calculation
    repoNodes2[name].size =
      Math.pow(repoNodes2[name].size, size_weight) *
      Math.pow(repoNodes2[name].count, count_weight);
  });

  const topLangs = Object.keys(repoNodes2)
    .sort((a, b) => repoNodes2[b].size - repoNodes2[a].size)
    .reduce((result, key) => {
      result[key] = repoNodes2[key];
      return result;
    }, {});

  return topLangs;
};

export { fetchTopLanguages };
export default fetchTopLanguages;
