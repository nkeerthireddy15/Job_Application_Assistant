import { chromium } from "playwright";
import path from "path";

const args = process.argv.slice(2);

const valueAfter = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const jobId = valueAfter("--job");
const directUrl = valueAfter("--url");

const apiBase =
  process.env.API_URL ||
  "http://localhost:5050/api";

if (!jobId && !directUrl) {
  console.error(
    "Usage: npm run autofill -- --job <jobId> OR npm run autofill -- --url <applicationUrl>"
  );

  process.exit(1);
}

/* =====================================================
   API
===================================================== */

async function json(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${url}`
    );
  }

  return response.json();
}

/* =====================================================
   LOAD PROFILE / JOB
===================================================== */

const profile = (
  await json(`${apiBase}/profile`)
).data;

let job = null;
let url = directUrl;
let answers = [];

if (jobId) {
  job = (
    await json(
      `${apiBase}/jobs/${jobId}`
    )
  ).data;

  url = job?.url;

  answers = (
    await json(
      `${apiBase}/answers/${jobId}`
    )
  ).data.filter(
    (answer) =>
      answer.approved
  );
}

if (!url) {
  console.error(
    "No application URL found."
  );

  process.exit(1);
}

/* =====================================================
   PERSISTENT BROWSER
===================================================== */

const userDataDir =
  path.resolve(
    process.cwd(),
    ".applypilot-browser-profile"
  );

const context =
  await chromium.launchPersistentContext(
    userDataDir,
    {
      headless:
        process.env
          .AUTOFILL_HEADLESS ===
        "true",

      viewport: null,

      args: [
        "--start-maximized",
      ],
    }
  );

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(
    "\nSaving browser session..."
  );

  try {
    await context.close();
  } catch {}

  console.log(
    "Browser session saved."
  );

  process.exit(0);
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);

let pages =
  context.pages();

let page =
  pages.length
    ? pages[0]
    : await context.newPage();

await page.goto(url, {
  waitUntil:
    "domcontentloaded",

  timeout: 60000,
});

await page.waitForTimeout(
  1500
);

/* =====================================================
   REPORT
===================================================== */

const report = {
  site: "",
  applyClicked: false,
  formDetected: false,
  fieldsFilled: 0,
  selectsFilled: 0,
  savedAnswersFilled: 0,
  resumeAttached: false,
  manualReview: [],
};

/* =====================================================
   SITE DETECTION
===================================================== */

function detectSite(
  currentUrl = ""
) {
  const value =
    String(
      currentUrl
    ).toLowerCase();

  if (
    value.includes(
      "linkedin.com"
    )
  ) {
    return "linkedin";
  }

  if (
    value.includes(
      "wellfound.com"
    )
  ) {
    return "wellfound";
  }

  if (
    value.includes(
      "greenhouse.io"
    )
  ) {
    return "greenhouse";
  }

  if (
    value.includes(
      "lever.co"
    )
  ) {
    return "lever";
  }

  if (
    value.includes(
      "ashbyhq.com"
    )
  ) {
    return "ashby";
  }

  if (
    value.includes(
      "workable.com"
    )
  ) {
    return "workable";
  }

  if (
    value.includes(
      "indeed."
    )
  ) {
    return "indeed";
  }

  if (
    value.includes(
      "naukri.com"
    )
  ) {
    return "naukri";
  }

  return "generic";
}

report.site =
  detectSite(
    page.url()
  );

/* =====================================================
   HELPERS
===================================================== */

function normalizeText(
  value = ""
) {
  return String(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9+#.\- ]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function hasAny(
  text,
  keys
) {
  const normalized =
    normalizeText(text);

  return keys.some(
    (key) =>
      normalized.includes(
        normalizeText(key)
      )
  );
}

async function metadata(
  element
) {
  return element.evaluate(
    (node) => {
      const id =
        node.id || "";

      const directLabel =
        id
          ? document.querySelector(
              `label[for="${CSS.escape(
                id
              )}"]`
            )?.innerText ||
            ""
          : "";

      const parentText =
        node.closest(
          [
            "label",
            "fieldset",
            ".field",
            ".form-group",
            ".application-question",
            ".application-field",
            "[class*='field']",
            "[class*='question']",
          ].join(",")
        )?.innerText ||
        "";

      return [
        node.name,
        node.id,
        node.placeholder,
        node.getAttribute(
          "aria-label"
        ),
        directLabel,
        parentText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }
  );
}

/* =====================================================
   PROFILE FIELD MAPPINGS
===================================================== */

const fullName =
  `${profile.firstName || ""} ${
    profile.lastName || ""
  }`.trim();

const patterns = [
  {
    keys: [
      "first name",
      "firstname",
      "first_name",
    ],

    value:
      profile.firstName,
  },

  {
    keys: [
      "last name",
      "lastname",
      "last_name",
    ],

    value:
      profile.lastName,
  },

  {
    keys: [
      "full name",
      "your name",
      "candidate name",
    ],

    value:
      fullName,
  },

  {
    keys: [
      "email",
      "e-mail",
      "email address",
    ],

    value:
      profile.email,
  },

  {
    keys: [
      "mobile phone number",
      "mobile number",
      "phone number",
      "phone",
      "telephone",
      "contact number",
    ],

    value:
      profile.phone,
  },

  {
    keys: [
      "location city",
      "location (city)",
      "current location",
      "location",
      "city",
    ],

    value:
      profile.city,
  },

  {
    keys: [
      "linkedin",
      "linkedin url",
      "linkedin profile",
    ],

    value:
      profile.linkedin,
  },

  {
    keys: [
      "github",
      "github url",
      "github profile",
    ],

    value:
      profile.github,
  },

  {
    keys: [
      "portfolio",
      "portfolio url",
      "website",
      "personal site",
      "personal website",
    ],

    value:
      profile.portfolio,
  },

  {
    keys: [
      "current ctc",
      "current salary",
      "current compensation",
      "current annual salary",
    ],

    value:
      profile.currentCTC,
  },

  {
    keys: [
      "expected ctc",
      "expected salary",
      "expected compensation",
      "desired salary",
      "salary expectation",
    ],

    value:
      profile.expectedCTC,
  },

  {
    keys: [
      "notice period",
      "joining time",
      "availability",
      "available to join",
    ],

    value:
      profile.noticePeriod,
  },

  {
    keys: [
      "years of experience",
      "total experience",
      "work experience",
      "experience years",
    ],

    value:
      profile.yearsExperience,
  },

  {
    keys: [
      "current title",
      "current role",
      "job title",
      "current job title",
    ],

    value:
      profile.currentTitle,
  },
].filter(
  (item) =>
    item.value !== null &&
    item.value !== undefined &&
    item.value !== ""
);

/* =====================================================
   CLICK APPLY
===================================================== */

async function clickApplyButton() {
  const candidates = [
    page.getByRole(
      "button",
      {
        name:
          /^(easy apply|apply|apply now|quick apply)$/i,
      }
    ),

    page.getByRole(
      "link",
      {
        name:
          /^(apply|apply now|quick apply)$/i,
      }
    ),

    page.locator(
      'button:has-text("Easy Apply")'
    ),

    page.locator(
      'button:has-text("Apply")'
    ),

    page.locator(
      'a:has-text("Apply")'
    ),
  ];

  for (
    const locator of candidates
  ) {
    const count =
      await locator.count();

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const element =
        locator.nth(i);

      if (
        !(
          await element
            .isVisible()
            .catch(
              () => false
            )
        )
      ) {
        continue;
      }

      const text =
        await element
          .innerText()
          .catch(
            () => ""
          );

      if (
        /submit|send application|finish application/i.test(
          text
        )
      ) {
        continue;
      }

      const beforePages =
        context.pages();

      try {
        await element.click({
          timeout: 5000,
        });

        report.applyClicked =
          true;

        await page.waitForTimeout(
          1800
        );

        const afterPages =
          context.pages();

        if (
          afterPages.length >
          beforePages.length
        ) {
          page =
            afterPages[
              afterPages.length -
                1
            ];

          await page.waitForLoadState(
            "domcontentloaded",
            {
              timeout: 30000,
            }
          );

          await page.waitForTimeout(
            800
          );
        }

        report.site =
          detectSite(
            page.url()
          );

        return true;
      } catch {}
    }
  }

  return false;
}

/* =====================================================
   GENERIC INPUT FILL
===================================================== */

async function fillItem(
  item
) {
  const controls =
    page.locator(
      [
        'input:not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])',
        "textarea",
      ].join(",")
    );

  const count =
    await controls.count();

  for (
    let i = 0;
    i < count;
    i++
  ) {
    const element =
      controls.nth(i);

    if (
      !(
        await element
          .isVisible()
          .catch(
            () => false
          )
      )
    ) {
      continue;
    }

    const meta =
      await metadata(
        element
      ).catch(
        () => ""
      );

    if (
      !hasAny(
        meta,
        item.keys
      )
    ) {
      continue;
    }

    const current =
      await element
        .inputValue()
        .catch(
          () => ""
        );

    if (
      current &&
      current.trim()
    ) {
      continue;
    }

    try {
      await element
        .click()
        .catch(
          () => {}
        );

      await element.fill(
        String(
          item.value
        )
      );

      await element
        .press("Tab")
        .catch(
          () => {}
        );

      report.fieldsFilled +=
        1;

      return true;
    } catch {}
  }

  return false;
}

/* =====================================================
   SELECT FILL
===================================================== */

async function chooseSelectValue(
  select,
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  const options =
    await select
      .locator("option")
      .allTextContents();

  const wanted =
    normalizeText(value);

  for (
    const optionText of options
  ) {
    const normalized =
      normalizeText(
        optionText
      );

    if (
      normalized === wanted ||
      normalized.includes(
        wanted
      ) ||
      wanted.includes(
        normalized
      )
    ) {
      try {
        await select.selectOption({
          label:
            optionText,
        });

        report.selectsFilled +=
          1;

        return true;
      } catch {}
    }
  }

  const numeric =
    Number(value);

  if (
    !Number.isNaN(
      numeric
    )
  ) {
    for (
      const optionText of options
    ) {
      const match =
        optionText.match(
          /\d+/
        );

      if (
        match &&
        Number(
          match[0]
        ) === numeric
      ) {
        try {
          await select.selectOption({
            label:
              optionText,
          });

          report.selectsFilled +=
            1;

          return true;
        } catch {}
      }
    }
  }

  return false;
}

async function fillSelects() {
  const selects =
    page.locator(
      "select"
    );

  const count =
    await selects.count();

  for (
    let i = 0;
    i < count;
    i++
  ) {
    const select =
      selects.nth(i);

    if (
      !(
        await select
          .isVisible()
          .catch(
            () => false
          )
      )
    ) {
      continue;
    }

    const meta =
      await metadata(
        select
      ).catch(
        () => ""
      );

    if (
      hasAny(
        meta,
        [
          "experience",
          "years of experience",
        ]
      )
    ) {
      if (
        await chooseSelectValue(
          select,
          profile.yearsExperience
        )
      ) {
        continue;
      }
    }

    if (
      hasAny(
        meta,
        [
          "location",
          "city",
        ]
      )
    ) {
      if (
        await chooseSelectValue(
          select,
          profile.city
        )
      ) {
        continue;
      }
    }

    if (
      hasAny(
        meta,
        [
          "notice period",
          "availability",
        ]
      )
    ) {
      await chooseSelectValue(
        select,
        profile.noticePeriod
      );
    }
  }
}

/* =====================================================
   APPROVED ANSWERS
===================================================== */

async function fillSavedAnswers() {
  for (
    const saved of answers
  ) {
    const words =
      saved.question
        .toLowerCase()
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 4
        )
        .slice(0, 6);

    if (
      !words.length
    ) {
      continue;
    }

    const filled =
      await fillItem({
        keys:
          words,

        value:
          saved.answer,
      });

    if (filled) {
      report.savedAnswersFilled +=
        1;
    }
  }
}

/* =====================================================
   RESUME
===================================================== */

const resumePath =
  job?.recommendedResumeId
    ?.path;

async function attachResume() {
  if (
    !resumePath ||
    report.resumeAttached
  ) {
    return false;
  }

  const inputs =
    page.locator(
      'input[type="file"]'
    );

  const count =
    await inputs.count();

  for (
    let i = 0;
    i < count;
    i++
  ) {
    const input =
      inputs.nth(i);

    const meta =
      await metadata(
        input
      ).catch(
        () => ""
      );

    const accept =
      (
        await input
          .getAttribute(
            "accept"
          )
          .catch(
            () => ""
          )
      ) || "";

    const likelyResume =
      /resume|cv|curriculum/.test(
        meta
      ) ||
      !accept ||
      /pdf|doc|docx/i.test(
        accept
      );

    if (
      !likelyResume
    ) {
      continue;
    }

    try {
      await input.setInputFiles(
        resumePath
      );

      report.resumeAttached =
        true;

      console.log(
        "[Autofill] Resume attached"
      );

      return true;
    } catch {}
  }

  return false;
}

/* =====================================================
   SAFE QUESTIONS
===================================================== */

async function clickRadioByQuestion(
  questionPattern,
  desiredAnswer
) {
  if (
    desiredAnswer === null ||
    desiredAnswer === undefined
  ) {
    return false;
  }

  const containers =
    page.locator(
      [
        "fieldset",
        ".application-question",
        "[class*='question']",
        "[class*='field']",
      ].join(",")
    );

  const count =
    await containers.count();

  for (
    let i = 0;
    i < count;
    i++
  ) {
    const container =
      containers.nth(i);

    const text =
      normalizeText(
        await container
          .innerText()
          .catch(
            () => ""
          )
      );

    if (
      !questionPattern.test(
        text
      )
    ) {
      continue;
    }

    const desired =
      normalizeText(
        desiredAnswer
      );

    const labels =
      container.locator(
        "label"
      );

    for (
      let j = 0;
      j <
      (await labels.count());
      j++
    ) {
      const label =
        labels.nth(j);

      const labelText =
        normalizeText(
          await label
            .innerText()
            .catch(
              () => ""
            )
        );

      if (
        !labelText.includes(
          desired
        )
      ) {
        continue;
      }

      const input =
        label.locator(
          'input[type="radio"], input[type="checkbox"]'
        );

      if (
        (await input.count()) >
        0
      ) {
        await input
          .first()
          .check()
          .catch(
            () => {}
          );

        return true;
      }

      await label
        .click()
        .catch(
          () => {}
        );

      return true;
    }
  }

  return false;
}

async function fillSafeQuestions() {
  if (
    profile.sponsorshipAnswer
  ) {
    await clickRadioByQuestion(
      /sponsor|sponsorship/,
      profile.sponsorshipAnswer
    );
  }
}

/* =====================================================
   GENERIC AUTOFILL PASS
===================================================== */

async function runAutofillPass() {
  for (
    const item of patterns
  ) {
    await fillItem(
      item
    );
  }

  await fillSelects();

  await fillSavedAnswers();

  await attachResume();

  await fillSafeQuestions();
}

/* =====================================================
   GENERIC FORM DETECTION
===================================================== */

async function detectGenericForm() {
  const selectors = [
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="file"]',
    "textarea",
  ];

  for (
    const selector of selectors
  ) {
    const locator =
      page.locator(
        selector
      );

    for (
      let i = 0;
      i <
      (await locator.count());
      i++
    ) {
      if (
        await locator
          .nth(i)
          .isVisible()
          .catch(
            () => false
          )
      ) {
        report.formDetected =
          true;

        return true;
      }
    }
  }

  return false;
}

/* =====================================================
   LINKEDIN DIALOG
===================================================== */

async function getLinkedInDialog() {
  const selectors = [
    'div[role="dialog"]',
    ".jobs-easy-apply-modal",
    ".jobs-easy-apply-content",
    ".artdeco-modal",
    "[data-test-modal]",
  ];

  for (const selector of selectors) {
    const candidates = page.locator(selector);
    const count = await candidates.count();

    for (let i = 0; i < count; i++) {
      const candidate = candidates.nth(i);

      const visible = await candidate
        .isVisible()
        .catch(() => false);

      if (!visible) continue;

      const text = normalizeText(
        await candidate
          .innerText()
          .catch(() => "")
      );

      const hasApplicationSignals =
        text.includes("apply to") ||
        text.includes("easy apply") ||
        text.includes("mobile phone number") ||
        text.includes("phone country code") ||
        text.includes("email address") ||
        text.includes("contact info") ||
        text.includes("resume") ||
        text.includes("additional questions") ||
        text.includes("review your application") ||
        text.includes("next") ||
        text.includes("continue");

      if (hasApplicationSignals) {
        return candidate;
      }
    }
  }

  /*
   * Fallback:
   * find visible Easy Apply fields
   * and walk up to their modal container.
   */
  const phoneLabel = page.getByText(
    /mobile phone number/i
  );

  if (
    (await phoneLabel.count()) > 0 &&
    await phoneLabel
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    const dialogParent =
      phoneLabel
        .first()
        .locator(
          'xpath=ancestor::*[@role="dialog"][1]'
        );

    if (
      (await dialogParent.count()) > 0
    ) {
      return dialogParent.first();
    }

    const modalParent =
      phoneLabel
        .first()
        .locator(
          'xpath=ancestor::*[contains(@class,"artdeco-modal")][1]'
        );

    if (
      (await modalParent.count()) > 0
    ) {
      return modalParent.first();
    }
  }

  return null;
}

/* =====================================================
   LINKEDIN PHONE + LOCATION
===================================================== */

async function fillLinkedInPhoneAndLocation() {
  let filledAnything =
    false;

  try {
    let phone =
      page.getByLabel(
        /mobile phone number/i
      );

    if (
      (await phone.count()) ===
      0
    ) {
      phone =
        page.locator(
          [
            'input[type="tel"]',
            'input[id*="phone" i]',
            'input[name*="phone" i]',
            'input[aria-label*="phone" i]',
          ].join(",")
        );
    }

    if (
      (await phone.count()) >
        0 &&
      profile.phone
    ) {
      const input =
        phone.first();

      const current =
        await input
          .inputValue()
          .catch(
            () => ""
          );

      if (!current) {
        await input
          .scrollIntoViewIfNeeded()
          .catch(
            () => {}
          );

        await input.click();

        await input.fill(
          String(
            profile.phone
          )
        );

        await input
          .press("Tab")
          .catch(
            () => {}
          );

        console.log(
          `[LinkedIn] Mobile phone filled: ${profile.phone}`
        );

        report.fieldsFilled +=
          1;

        filledAnything =
          true;
      }
    }
  } catch (error) {
    console.log(
      "[LinkedIn] Phone error:",
      error.message
    );
  }

  try {
    let location =
      page.getByLabel(
        /location.*city/i
      );

    if (
      (await location.count()) ===
      0
    ) {
      location =
        page.locator(
          [
            'input[id*="location" i]',
            'input[name*="location" i]',
            'input[aria-label*="location" i]',
            'input[placeholder*="location" i]',
          ].join(",")
        );
    }

    if (
      (await location.count()) >
        0 &&
      profile.city
    ) {
      const input =
        location.first();

      const current =
        await input
          .inputValue()
          .catch(
            () => ""
          );

      if (!current) {
        await input
          .scrollIntoViewIfNeeded()
          .catch(
            () => {}
          );

        await input.click();

        await input.fill(
          String(
            profile.city
          )
        );

        console.log(
          `[LinkedIn] Typed location: ${profile.city}`
        );

        await page.waitForTimeout(
          1000
        );

        const suggestions =
          page.locator(
            [
              '[role="option"]',
              ".basic-typeahead__selectable",
              ".search-basic-typeahead__selectable",
            ].join(",")
          );

        let selected =
          false;

        const count =
          await suggestions.count();

        for (
          let i = 0;
          i < count;
          i++
        ) {
          const option =
            suggestions.nth(i);

          if (
            !(
              await option
                .isVisible()
                .catch(
                  () => false
                )
            )
          ) {
            continue;
          }

          const text =
            normalizeText(
              await option
                .innerText()
                .catch(
                  () => ""
                )
            );

          if (
            text.includes(
              normalizeText(
                profile.city
              )
            )
          ) {
            await option.click();

            selected =
              true;

            console.log(
              `[LinkedIn] Selected location: ${text}`
            );

            break;
          }
        }

        if (!selected) {
          await input
            .press(
              "ArrowDown"
            )
            .catch(
              () => {}
            );

          await page.waitForTimeout(
            200
          );

          await input
            .press(
              "Enter"
            )
            .catch(
              () => {}
            );
        }

        const finalValue =
          await input
            .inputValue()
            .catch(
              () => ""
            );

        if (finalValue) {
          console.log(
            `[LinkedIn] Location value: ${finalValue}`
          );

          report.fieldsFilled +=
            1;

          filledAnything =
            true;
        }
      }
    }
  } catch (error) {
    console.log(
      "[LinkedIn] Location error:",
      error.message
    );
  }

  return filledAnything;
}

/* =====================================================
   LINKEDIN NEXT / REVIEW CONTROL
===================================================== */

async function clickLinkedInProgressButton(
  dialog
) {
  const forbidden =
    /submit application|send application|submit|finish application/i;

  const finalButtons =
    dialog.getByRole(
      "button",
      {
        name:
          forbidden,
      }
    );

  for (
    let i = 0;
    i <
    (await finalButtons.count());
    i++
  ) {
    const button =
      finalButtons.nth(i);

    if (
      await button
        .isVisible()
        .catch(
          () => false
        )
    ) {
      const text =
        await button
          .innerText()
          .catch(
            () =>
              "Submit application"
          );

      console.log(
        `[LinkedIn] Final button detected: ${text.trim()}. Stopping.`
      );

      return {
        type: "final",
        clicked: false,
      };
    }
  }

  const reviewCandidates = [
    dialog.getByRole(
      "button",
      {
        name:
          /^review$/i,
      }
    ),

    dialog.locator(
      'button:has-text("Review")'
    ),
  ];

  for (
    const locator of reviewCandidates
  ) {
    const count =
      await locator.count();

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const button =
        locator.nth(i);

      if (
        !(
          await button
            .isVisible()
            .catch(
              () => false
            )
        )
      ) {
        continue;
      }

      const text =
        await button
          .innerText()
          .catch(
            () => "Review"
          );

      if (
        forbidden.test(
          text
        )
      ) {
        continue;
      }

      console.log(
        "[LinkedIn] Review step reached. Stopping before Review."
      );

      return {
        type: "review",
        clicked: false,
      };
    }
  }

  const candidates = [
    dialog.getByRole(
      "button",
      {
        name:
          /^(next|continue)$/i,
      }
    ),

    dialog.locator(
      'button:has-text("Next")'
    ),

    dialog.locator(
      'button:has-text("Continue")'
    ),
  ];

  for (
    const locator of candidates
  ) {
    const count =
      await locator.count();

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const button =
        locator.nth(i);

      if (
        !(
          await button
            .isVisible()
            .catch(
              () => false
            )
        )
      ) {
        continue;
      }

      const text =
        await button
          .innerText()
          .catch(
            () => ""
          );

      const normalized =
        text.trim();

      if (
        forbidden.test(
          normalized
        )
      ) {
        console.log(
          `[LinkedIn] Refusing to click final button: ${normalized}`
        );

        return {
          type: "final",
          clicked: false,
        };
      }

      if (
        !/^(next|continue)$/i.test(
          normalized
        )
      ) {
        continue;
      }

      const disabled =
        await button
          .isDisabled()
          .catch(
            () => false
          );

      if (disabled) {
        console.log(
          `[LinkedIn] ${normalized} is disabled. Required information is still missing.`
        );

        return {
          type: "blocked",
          clicked: false,
        };
      }

      await button.click();

      console.log(
        `[LinkedIn] Clicked ${normalized}`
      );

      await page.waitForTimeout(
        1300
      );

      return {
        type: "next",
        clicked: true,
      };
    }
  }

  return {
    type: "none",
    clicked: false,
  };
}

/* =====================================================
   LINKEDIN MULTI STEP FLOW
===================================================== */

async function runLinkedInEasyApplyFlow() {
  const maxSteps =
    8;

  for (
    let step = 1;
    step <= maxSteps;
    step++
  ) {
    console.log(
      `\n[LinkedIn] Processing Easy Apply step ${step}`
    );

    let dialog =
      null;

    for (
      let attempt = 0;
      attempt < 12;
      attempt++
    ) {
      dialog =
        await getLinkedInDialog();

      if (dialog) {
        break;
      }

      await page.waitForTimeout(
        400
      );
    }

    if (!dialog) {
      console.log(
        "[LinkedIn] Easy Apply dialog disappeared or could not be found."
      );

      report.manualReview.push(
        "LinkedIn Easy Apply dialog could not be found on the current step."
      );

      return;
    }

    report.formDetected =
      true;

    if (step === 1) {
      await fillLinkedInPhoneAndLocation();
    }

    await runAutofillPass();

    await page.waitForTimeout(
      500
    );

    await runAutofillPass();

    const result =
      await clickLinkedInProgressButton(
        dialog
      );

    if (
      result.type ===
      "review"
    ) {
      report.manualReview.push(
        "LinkedIn Easy Apply reached Review. Review everything manually before continuing."
      );

      return;
    }

    if (
      result.type ===
      "final"
    ) {
      report.manualReview.push(
        "LinkedIn final submission button detected. ApplyPilot stopped before submitting."
      );

      return;
    }

    if (
      result.type ===
      "blocked"
    ) {
      report.manualReview.push(
        "LinkedIn cannot continue because a required field or screening answer is still missing."
      );

      return;
    }

    if (
      result.type ===
      "none"
    ) {
      report.manualReview.push(
        "No safe LinkedIn Next/Continue button was found on the current step."
      );

      return;
    }
  }

  report.manualReview.push(
    "LinkedIn Easy Apply reached the maximum automated step limit."
  );
}

/* =====================================================
   WELLFOUND
===================================================== */

async function detectWellfoundForm() {
  const body =
    normalizeText(
      await page
        .locator("body")
        .innerText()
        .catch(
          () => ""
        )
    );

  const open =
    body.includes(
      "your application"
    ) &&
    (
      body.includes(
        "send application"
      ) ||
      body.includes(
        "what interests you about working for this company"
      )
    );

  if (open) {
    report.formDetected =
      true;
  }

  return open;
}

/* =====================================================
   MAIN
===================================================== */

const currentSite =
  detectSite(
    page.url()
  );

if (currentSite === "linkedin") {
  console.log("[LinkedIn] Assist Mode enabled.");
  console.log("[LinkedIn] ApplyPilot will NOT click Easy Apply, Next, Review, or Submit.");
  console.log("[LinkedIn] Navigate manually; visible recognized fields will be filled.");
  report.manualReview.push("LinkedIn Assist Mode: navigation and final submission are manual. Autofill assistance is not risk-free under LinkedIn rules.");
  for (let pass = 1; pass <= 120; pass++) {
    const dialog = await getLinkedInDialog();
    if (dialog) {
      report.formDetected = true;
      await runAutofillPass();
      await fillLinkedInPhoneAndLocation();
    }
    await page.waitForTimeout(1500);
  }
} else if (
  currentSite ===
  "wellfound"
)  {
  let formOpen =
    await detectWellfoundForm();

  if (!formOpen) {
    await clickApplyButton();

    await page.waitForTimeout(
      2200
    );

    formOpen =
      await detectWellfoundForm();
  }

  if (formOpen) {
    await runAutofillPass();

    await page.waitForTimeout(
      700
    );

    await runAutofillPass();
  }
} else {
  let formOpen =
    await detectGenericForm();

  if (!formOpen) {
    await clickApplyButton();

    await page.waitForTimeout(
      2200
    );

    formOpen =
      await detectGenericForm();
  }

  if (formOpen) {
    await runAutofillPass();

    await page.waitForTimeout(
      700
    );

    await runAutofillPass();
  }
}

/* =====================================================
   REVIEW WARNINGS
===================================================== */

if (
  report.site ===
  "wellfound"
) {
  const body =
    normalizeText(
      await page
        .locator("body")
        .innerText()
        .catch(
          () => ""
        )
    );

  if (
    body.includes(
      "log in"
    ) &&
    body.includes(
      "your application"
    )
  ) {
    report.manualReview.push(
      "Wellfound appears logged out in the persistent browser profile. Log in manually once and rerun."
    );
  }

  if (
    body.includes(
      "what interests you about working for this company"
    )
  ) {
    report.manualReview.push(
      'Review the "What interests you about working for this company?" answer before submitting.'
    );
  }
}

if (
  !report.formDetected
) {
  report.manualReview.push(
    "No application form was detected. Login or another manual Apply action may be required."
  );
}

if (
  resumePath &&
  !report.resumeAttached
) {
  report.manualReview.push(
    "The recommended resume was not attached automatically. It may appear on a later step or the site may reuse your saved resume."
  );
}

if (
  [
    "linkedin",
    "indeed",
    "naukri",
  ].includes(
    report.site
  )
) {
  report.manualReview.push(
    "This site may require login, CAPTCHA, or other manual interaction. ApplyPilot does not bypass those checks."
  );
}

/* =====================================================
   REPORT
===================================================== */

console.log(
  "\n========================================"
);

console.log(
  "ApplyPilot Autofill Report"
);

console.log(
  "========================================"
);

console.log(
  `Site: ${report.site}`
);

console.log(
  `URL: ${page.url()}`
);

console.log(
  `Apply button clicked: ${
    report.applyClicked
      ? "YES"
      : "NO"
  }`
);

console.log(
  `Application form detected: ${
    report.formDetected
      ? "YES"
      : "NO"
  }`
);

console.log(
  `Text fields filled: ${report.fieldsFilled}`
);

console.log(
  `Select fields filled: ${report.selectsFilled}`
);

console.log(
  `Approved answers filled: ${report.savedAnswersFilled}`
);

console.log(
  `Resume attached: ${
    report.resumeAttached
      ? "YES"
      : "NO"
  }`
);

if (
  report.manualReview.length
) {
  console.log(
    "\nManual review needed:"
  );

  for (
    const item of [
      ...new Set(
        report.manualReview
      ),
    ]
  ) {
    console.log(
      `- ${item}`
    );
  }
}

console.log(
  "\nIMPORTANT:"
);

console.log(
  "ApplyPilot NEVER clicks the final Submit / Send Application button."
);

console.log(
  "Review every field and answer carefully in the browser before submitting."
);

console.log(
  "\nPress Ctrl+C in this terminal when finished."
);

console.log(
  "========================================\n"
);

await new Promise(
  () => {}
);