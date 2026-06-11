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
      page: submission.page,
      submittedAt: submission.submittedAt,
      userAgent: submission.userAgent,
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
      page: window.location.pathname.split("/").pop() || "index.html",
      submittedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
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
