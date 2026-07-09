document.documentElement.classList.add("js");

const header = document.querySelector("[data-elevate]");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const tabs = document.querySelectorAll(".tab");
const leadForms = document.querySelectorAll("[data-lead-form]");
const phoneDigitsPattern = /^0\d{10}$/;
const LEAD_ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbzwWFHp3lBrMRNUJz9vXRPq7Ck_gmLKzXUpOwMqCANR5yCtVAhY92ssWtBLxlsj2gkWTA/exec";

const elevateHeader = () => {
  header?.classList.toggle("is-elevated", window.scrollY > 12);
};

window.addEventListener("scroll", elevateHeader, { passive: true });
elevateHeader();

const closeNavigation = () => {
  header?.classList.remove("is-nav-open");
  navToggle?.setAttribute("aria-expanded", "false");
};

navToggle?.addEventListener("click", () => {
  const isOpen = header?.classList.toggle("is-nav-open") || false;
  navToggle.setAttribute("aria-expanded", String(isOpen));

  if (isOpen && navLinks) {
    const current = navLinks.querySelector('[aria-current="page"]');
    if (current) {
      const delta = current.getBoundingClientRect().top - navLinks.getBoundingClientRect().top;
      navLinks.scrollTop = Math.max(0, navLinks.scrollTop + delta - 56);
    }
  }
});

navLinks?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    closeNavigation();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof Node) || !header?.classList.contains("is-nav-open")) {
    return;
  }

  if (!header.contains(target)) {
    closeNavigation();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNavigation();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 720) {
    closeNavigation();
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetId = tab.dataset.plan;
    const panels = document.querySelectorAll(".plan-panel");
    if (panels.length) {
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === targetId);
      });
    } else {
      document.querySelectorAll(".plan-image").forEach((image) => {
        image.classList.toggle("active", image.id === targetId);
      });
    }
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
  });
});
const saveLocalSubmission = (submission) => {
  window.__leadSubmissions = window.__leadSubmissions || [];
  window.__leadSubmissions.push(submission);

  try {
    const saved = JSON.parse(localStorage.getItem("leadSubmissions") || "[]");
    saved.push(submission);
    localStorage.setItem("leadSubmissions", JSON.stringify(saved));
  } catch {
    // Storage can be unavailable in some browser privacy modes.
  }
};

const createHiddenInput = (name, value) => {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
};

const getPhoneDigits = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);

const formatPhoneNumber = (value) => {
  const digits = getPhoneDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const postLeadSubmission = (submission) => {
  if (!LEAD_ENDPOINT_URL) {
    return Promise.resolve({ ok: true, localOnly: true });
  }

  return new Promise((resolve) => {
    const frameName = `lead-submit-${Date.now()}`;
    const iframe = document.createElement("iframe");
    const transportForm = document.createElement("form");

    iframe.name = frameName;
    iframe.hidden = true;

    transportForm.hidden = true;
    transportForm.method = "POST";
    transportForm.action = LEAD_ENDPOINT_URL;
    transportForm.target = frameName;
    transportForm.acceptCharset = "UTF-8";

    Object.entries({
      name: submission.name,
      phone: submission.phone,
      area: submission.area,
      privacy: String(submission.privacyAgreed),
      submittedAt: submission.submittedAt,
    }).forEach(([name, value]) => {
      transportForm.append(createHiddenInput(name, value));
    });

    document.body.append(iframe, transportForm);
    transportForm.submit();

    window.setTimeout(() => {
      iframe.remove();
      transportForm.remove();
      resolve({ ok: true });
    }, 1400);
  });
};

const privacyModal = document.getElementById("privacyModal");

if (privacyModal) {
  let lastFocusedElement = null;

  const openPrivacyModal = (trigger) => {
    lastFocusedElement = trigger || document.activeElement;
    privacyModal.hidden = false;
    document.body.classList.add("privacy-open");
    privacyModal.querySelector(".privacy-modal-close")?.focus();
  };

  const closePrivacyModal = () => {
    privacyModal.hidden = true;
    document.body.classList.remove("privacy-open");
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  document.querySelectorAll("[data-privacy-open]").forEach((trigger) => {
    trigger.addEventListener("click", () => openPrivacyModal(trigger));
  });

  privacyModal.querySelectorAll("[data-privacy-close]").forEach((closer) => {
    closer.addEventListener("click", closePrivacyModal);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !privacyModal.hidden) {
      closePrivacyModal();
    }
  });
}

leadForms.forEach((form) => {
  const phoneInput = form.querySelector('[name="phone"]');

  phoneInput?.addEventListener("input", () => {
    phoneInput.value = formatPhoneNumber(phoneInput.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = form.querySelector(".form-note");
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const phone = formatPhoneNumber(formData.get("phone"));
    const phoneDigits = getPhoneDigits(phone);
    const area = String(formData.get("area") || "").trim();
    const privacyAgreed = formData.get("privacy") === "on";

    if (!form.checkValidity()) {
      form.reportValidity();
      if (note) {
        note.textContent = "필수 항목을 모두 입력해 주세요.";
      }
      return;
    }

    if (!phoneDigitsPattern.test(phoneDigits)) {
      phoneInput?.setCustomValidity("연락처는 010-1234-5678 형식으로 입력해 주세요.");
      phoneInput?.reportValidity();
      window.setTimeout(() => phoneInput?.setCustomValidity(""), 0);
      if (note) {
        note.textContent = "연락처는 010-1234-5678 형식으로 입력해 주세요.";
      }
      return;
    }

    if (phoneInput) {
      phoneInput.value = phone;
    }

    const submission = {
      name,
      phone,
      area,
      privacyAgreed,
      submittedAt: new Date().toISOString(),
    };

    saveLocalSubmission(submission);

    if (note) {
      note.textContent = "등록 정보를 전송하고 있습니다.";
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await postLeadSubmission(submission);
      if (!result.ok) {
        throw new Error(result.error || "등록에 실패했습니다.");
      }

      form.reset();
      if (note) {
        note.textContent = result.localOnly
          ? "등록 정보가 확인되었습니다. Apps Script URL 연결 후 시트로 전송됩니다."
          : "등록이 완료되었습니다.";
      }
    } catch (error) {
      if (note) {
        note.textContent = `등록 중 오류가 발생했습니다. ${error.message}`;
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
});

const revealTargets = new Set(document.querySelectorAll(".reveal"));
document.querySelectorAll("main img").forEach((image) => {
  // 메인 배너(hero)는 전용 등장 효과, 유니트 쇼케이스는 자체 슬라이드 전환을 쓰므로 스크롤 reveal에서 제외
  if (image.closest(".hero") || image.closest(".unit-showcase")) {
    return;
  }
  revealTargets.add(image);
});
revealTargets.forEach((target) => target.classList.add("reveal"));

// 이미지는 디코드가 끝난 뒤에 페이드를 시작해야 효과가 실제로 보인다.
// is-visible 직전에 강제 reflow로 opacity:0 상태를 확정해야
// (특히 캐시되어 즉시 complete인 이미지) 트랜지션이 점프하지 않고 재생된다.
const showTarget = (target) => {
  const reveal = () => {
    void target.offsetWidth; // opacity:0 상태를 확정
    target.classList.add("is-animated"); // transition 켜기
    void target.offsetWidth; // transition을 확정한 뒤
    target.classList.add("is-visible"); // 0 -> 1 페이드 시작
  };
  if (target.tagName === "IMG" && !target.complete) {
    target.addEventListener("load", reveal, { once: true });
    target.addEventListener("error", reveal, { once: true });
  } else {
    reveal();
  }
};

if ("IntersectionObserver" in window) {
  // 시차를 배치(줄) 단위로 리셋하지 않고 전역 예약 시각으로 이어간다
  // → 스크롤로 나중에 잡힌 요소도 앞 요소에 이어서 순차 등장
  const STAGGER_MS = 120;
  let lastRevealAt = 0;
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      // 같은 배치에 함께 들어온 요소는 문서 순서대로 시차를 두고 등장
      // (프리미엄 1~6 카드처럼 화면에 동시에 잡혀도 1번부터 차례로 나타난다)
      const incoming = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) =>
          a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
      const now = performance.now();
      incoming.forEach((entry) => {
        const startAt = Math.max(now, lastRevealAt + STAGGER_MS);
        lastRevealAt = startAt;
        entry.target.style.transitionDelay = `${Math.round(startAt - now)}ms`;
        entry.target.addEventListener(
          "transitionend",
          () => {
            entry.target.style.transitionDelay = "";
          },
          { once: true }
        );
        showTarget(entry.target);
        observer.unobserve(entry.target);
      });
    },
    // threshold는 요소 면적 대비 비율이라 뷰포트보다 큰 세로 이미지는
    // 첫 화면에서 비율을 못 채워 스크롤 전까지 트리거되지 않는다.
    // 0.01로 낮춰 요소가 뷰포트에 진입하면 바로 등장하게 한다.
    { rootMargin: "0px 0px -10% 0px", threshold: 0.01 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
} else {
  revealTargets.forEach((target) => showTarget(target));
}
