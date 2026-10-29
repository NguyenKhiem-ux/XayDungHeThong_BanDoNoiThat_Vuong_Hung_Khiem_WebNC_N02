// file hiển thị các nút trả lời nhanh dưới tin nhắn của chatbot; bấm nút là gửi nội dung đó như tin nhắn của khách.
export function ChatChips({ chips, disabled, onPick }: { chips?: string[]; disabled?: boolean; onPick: (text: string) => void }) {
  if (!chips?.length) return null;
  return <div className="chat-chips" role="group" aria-label="Gợi ý trả lời nhanh">
    {chips.map(chip => <button key={chip} type="button" disabled={disabled} onClick={() => onPick(chip)}>{chip}</button>)}
  </div>;
}
