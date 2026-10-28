// ConditionFields 폼 값을 요청 본문으로 바꾼다. 빈 항목은 보내지 않는다.
export default function readConditions(form: HTMLFormElement) {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const optional = (name: string) => (text(name) ? { [name]: text(name) } : {});
  return {
    message: text("message"),
    ...optional("purpose"),
    ...optional("materialType"),
    ...optional("eventDate"),
    ...optional("desiredDeliveryDate"),
  };
}
