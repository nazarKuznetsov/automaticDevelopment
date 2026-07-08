const COPY_RESET_MS = 1600;

async function copyText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  textArea.style.left = "-1000px";
  document.body.append(textArea);
  textArea.select();

  try {
    const execCommand = Reflect.get(document, "execCommand") as ((command: string) => boolean) | undefined;
    const copied = execCommand?.call(document, "copy");
    if (!copied) {
      throw new Error("Copy command failed.");
    }
  } finally {
    textArea.remove();
  }
}

document.querySelectorAll<HTMLElement>("pre > code").forEach((codeBlock) => {
  const pre = codeBlock.parentElement;
  if (!(pre instanceof HTMLPreElement) || pre.querySelector(".copy-code-button")) {
    return;
  }

  pre.classList.add("copy-enabled");

  const button = document.createElement("button");
  button.className = "copy-code-button";
  button.type = "button";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code block");

  let resetTimer = 0;

  button.addEventListener("click", async () => {
    window.clearTimeout(resetTimer);
    button.disabled = true;

    try {
      await copyText(codeBlock.textContent ?? "");
      button.textContent = "Copied";
      button.dataset.state = "copied";
    } catch {
      button.textContent = "Failed";
      button.dataset.state = "failed";
    } finally {
      button.disabled = false;
      resetTimer = window.setTimeout(() => {
        button.textContent = "Copy";
        delete button.dataset.state;
      }, COPY_RESET_MS);
    }
  });

  pre.append(button);
});
