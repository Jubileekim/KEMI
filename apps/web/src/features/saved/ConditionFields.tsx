import { MATERIAL_TYPES, VIDEO_PURPOSES } from "@kemi/shared";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { label, materialTypeLabels, purposeLabels } from "../live/labels";
import { Field } from "../live/ui";
import { selectClass } from "../live/errors";

// 직접 의뢰·일괄 문의가 함께 쓰는 요청 조건(INQ-01).
// 제작자가 "내 자료·일정으로 만들 수 있는지" 바로 판단할 수 있게 보유 자료와 희망 납품일을 받는다.
// 폼 이름: message, purpose, materialType, eventDate, desiredDeliveryDate
export default function ConditionFields({ idPrefix }: { idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <Field id={id("purpose")} label="영상 목적 (선택)">
        <select
          id={id("purpose")}
          name="purpose"
          className={selectClass}
          defaultValue=""
        >
          <option value="">선택하지 않음</option>
          {VIDEO_PURPOSES.map((value) => (
            <option key={value} value={value}>
              {label(purposeLabels, value)}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="type-label-md">가진 자료 (선택)</legend>
        <div className="flex flex-wrap gap-4">
          {MATERIAL_TYPES.map((value) => (
            <label
              key={value}
              htmlFor={id(`material-${value}`)}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                id={id(`material-${value}`)}
                type="radio"
                name="materialType"
                value={value}
                className="accent-primary"
              />
              {label(materialTypeLabels, value)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("event")} label="행사일 (선택)">
          <Input id={id("event")} name="eventDate" type="date" />
        </Field>
        <Field
          id={id("due")}
          label="희망 납품일 (선택)"
          hint="행사 전에 받아 재생을 확인할 수 있게 행사일보다 앞으로 잡아 주세요."
        >
          <Input id={id("due")} name="desiredDeliveryDate" type="date" />
        </Field>
      </div>
      <Field
        id={id("message")}
        label="요청사항 (10자 이상)"
        hint="원하는 분위기, 영상 길이, 꼭 넣고 싶은 장면·문구를 적어 주세요."
      >
        <Textarea
          id={id("message")}
          name="message"
          rows={5}
          required
          maxLength={2000}
        />
      </Field>
    </>
  );
}
