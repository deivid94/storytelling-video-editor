interface InterpretationAlertProps {
  message: string;
}

export function InterpretationAlert({ message }: InterpretationAlertProps) {
  return (
    <p role="alert" className="alert">
      {message}
    </p>
  );
}
