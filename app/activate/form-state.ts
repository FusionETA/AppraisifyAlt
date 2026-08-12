export type ActivateFormState = {
  status: "idle" | "error"
  message: string
}

export const initialActivateFormState: ActivateFormState = {
  status: "idle",
  message: "",
}
