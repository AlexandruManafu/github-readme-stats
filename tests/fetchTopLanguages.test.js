import { afterEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { fetchTopLanguages } from "../src/fetchers/top-languages.js";

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

const data_langs = {
  data: {
    user: {
      repositories: {
        nodes: [
          {
            name: "test-repo-1",
            languages: {
              edges: [{ size: 100, node: { color: "#0f0", name: "HTML" } }],
            },
          },
          {
            name: "test-repo-2",
            languages: {
              edges: [{ size: 100, node: { color: "#0f0", name: "HTML" } }],
            },
          },
          {
            name: "test-repo-3",
            languages: {
              edges: [
                { size: 100, node: { color: "#0ff", name: "javascript" } },
              ],
            },
          },
          {
            name: "test-repo-4",
            languages: {
              edges: [
                { size: 100, node: { color: "#0ff", name: "javascript" } },
              ],
            },
          },
        ],
      },
    },
  },
};

const error = {
  errors: [
    {
      type: "NOT_FOUND",
      path: ["user"],
      locations: [],
      message: "Could not resolve to a User with the login of 'noname'.",
    },
  ],
};

describe("FetchTopLanguages", () => {
  it("should fetch correct language data while using the new calculation", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages("anuraghazra", [], 0.5, 0.5);
    expect(repo).toStrictEqual({
      HTML: {
        color: "#0f0",
        count: 2,
        name: "HTML",
        size: 20.000000000000004,
      },
      javascript: {
        color: "#0ff",
        count: 2,
        name: "javascript",
        size: 20.000000000000004,
      },
    });
  });

  it("should fetch correct language data while excluding the 'test-repo-1' repository", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages("anuraghazra", ["test-repo-1"]);
    expect(repo).toStrictEqual({
      HTML: {
        color: "#0f0",
        count: 1,
        name: "HTML",
        size: 100,
      },
      javascript: {
        color: "#0ff",
        count: 2,
        name: "javascript",
        size: 200,
      },
    });
  });

  it("should fetch correct language data while using the old calculation", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages("anuraghazra", [], 1, 0);
    expect(repo).toStrictEqual({
      HTML: {
        color: "#0f0",
        count: 2,
        name: "HTML",
        size: 200,
      },
      javascript: {
        color: "#0ff",
        count: 2,
        name: "javascript",
        size: 200,
      },
    });
  });

  it("should rank languages by the number of repositories they appear in", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages("anuraghazra", [], 0, 1);
    expect(repo).toStrictEqual({
      HTML: {
        color: "#0f0",
        count: 2,
        name: "HTML",
        size: 2,
      },
      javascript: {
        color: "#0ff",
        count: 2,
        name: "javascript",
        size: 2,
      },
    });
  });

  it("should throw specific error when user not found", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, error);

    await expect(fetchTopLanguages("anuraghazra")).rejects.toThrow(
      "Could not resolve to a User with the login of 'noname'.",
    );
  });

  it("should throw other errors with their message", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, {
      errors: [{ message: "Some test GraphQL error" }],
    });

    await expect(fetchTopLanguages("anuraghazra")).rejects.toThrow(
      "Some test GraphQL error",
    );
  });

  it("should throw error with specific message when error does not contain message property", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, {
      errors: [{ type: "TEST" }],
    });

    await expect(fetchTopLanguages("anuraghazra")).rejects.toThrow(
      "Something went wrong while trying to retrieve the language data using the GraphQL API.",
    );
  });

  it("should apply percent_contrib multipliers", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages("anuraghazra", [], 1, 0, [
      "test-repo-1:0.5",
      "test-repo-3:0.25",
    ].join("|"));
    expect(repo).toStrictEqual({
      HTML: {
        color: "#0f0",
        count: 1.5,
        name: "HTML",
        size: 150,
      },
      javascript: {
        color: "#0ff",
        count: 1.25,
        name: "javascript",
        size: 125,
      },
    });
  });

  it("should override languages using path_lang parameter", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages(
      "anuraghazra",
      [],
      1,
      0,
      [],
      "test-repo-1:TypeScript|test-repo-3:Python,Go",
    );
    expect(repo).toStrictEqual({
      TypeScript: {
        color: "#858585",
        count: 1,
        name: "TypeScript",
        size: 100,
      },
      HTML: {
        color: "#0f0",
        count: 1,
        name: "HTML",
        size: 100,
      },
      Python: {
        color: "#858585",
        count: 1,
        name: "Python",
        size: 50,
      },
      Go: {
        color: "#858585",
        count: 1,
        name: "Go",
        size: 50,
      },
      javascript: {
        color: "#0ff",
        count: 1,
        name: "javascript",
        size: 100,
      },
    });
  });

  it("should combine percent_contrib and path_lang filters", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    let repo = await fetchTopLanguages(
      "anuraghazra",
      [],
      1,
      0,
      "test-repo-1:0.5|test-repo-3:1",
      "test-repo-1:TypeScript",
    );
    expect(repo).toStrictEqual({
      HTML: {
        color: "#0f0",
        count: 1,
        name: "HTML",
        size: 100,
      },
      TypeScript: {
        color: "#858585",
        count: 0.5,
        name: "TypeScript",
        size: 50,
      },
      javascript: {
        color: "#0ff",
        count: 2,
        name: "javascript",
        size: 200,
      },
    });
  });
});
