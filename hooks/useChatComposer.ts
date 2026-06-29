import { useCallback, useRef, useState } from "react";
import { DEFAULT_AI_MODEL } from "@/config/models";

/** 聊天输入区状态：输入框、模型选择、自动增高 */
export function useChatComposer() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_AI_MODEL);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const resetInputHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, []);

  const clearInput = useCallback(() => {
    setInput("");
    resetInputHeight();
  }, [resetInputHeight]);

  return {
    input,
    setInput,
    selectedModel,
    setSelectedModel,
    inputRef,
    handleInput,
    clearInput,
    resetInputHeight,
  };
}
